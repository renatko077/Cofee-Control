using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Serialization;
using CoffeeControl.Api;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.EntityFrameworkCore;
using Serilog;
using Telegram.Bot;
using Telegram.Bot.Types;
using Telegram.Bot.Types.ReplyMarkups;

var builder = WebApplication.CreateBuilder(args);
builder.Host.UseSerilog((ctx, log) => log.ReadFrom.Configuration(ctx.Configuration).WriteTo.Console());

var connectionString = Environment.GetEnvironmentVariable("DATABASE_URL") ?? builder.Configuration.GetConnectionString("Default");
if (!string.IsNullOrWhiteSpace(connectionString) && connectionString.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
{
    var uri = new Uri(connectionString);
    var credentials = uri.UserInfo.Split(':', 2);
    connectionString = $"Host={uri.Host};Port={uri.Port};Database={uri.AbsolutePath.Trim('/')};Username={Uri.UnescapeDataString(credentials[0])};Password={Uri.UnescapeDataString(credentials.ElementAtOrDefault(1) ?? "")};SSL Mode=Require;Trust Server Certificate=true";
}

builder.Services.AddDbContext<AppDbContext>(options => options.UseNpgsql(connectionString ?? "Host=localhost;Database=coffeecontrol;Username=postgres;Password=postgres"));
builder.Services.AddSingleton<TelegramAuth>();
builder.Services.AddProblemDetails();
builder.Services.AddCors(options => options.AddDefaultPolicy(policy => policy.AllowAnyHeader().AllowAnyMethod().AllowAnyOrigin()));
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
    options.SerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
});

var app = builder.Build();
app.UseForwardedHeaders();
app.UseExceptionHandler(errorApp => errorApp.Run(async context =>
{
    var error = context.Features.Get<IExceptionHandlerFeature>()?.Error;
    app.Logger.LogError(error, "Unhandled API error. TraceId: {TraceId}", context.TraceIdentifier);
    context.Response.StatusCode = StatusCodes.Status500InternalServerError;
    await context.Response.WriteAsJsonAsync(new { code = "SERVER_ERROR", message = "Не удалось выполнить операцию. Попробуйте ещё раз.", traceId = context.TraceIdentifier });
}));
app.UseDefaultFiles();
app.UseStaticFiles();
app.UseCors();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();
    await DbSeeder.SeedAsync(db, default);
}

app.MapGet("/health", () => Results.Ok(new { status = "ok", utc = DateTime.UtcNow }));

var botToken = builder.Configuration["TELEGRAM_BOT_TOKEN"];
var webAppUrl = builder.Configuration["TELEGRAM_WEBAPP_URL"] ?? builder.Configuration["APP_BASE_URL"];
var bot = string.IsNullOrWhiteSpace(botToken) ? null : new TelegramBotClient(botToken);
if (bot is not null && !string.IsNullOrWhiteSpace(webAppUrl) && !app.Environment.IsDevelopment())
    await bot.SetWebhook($"{webAppUrl.TrimEnd('/')}/telegram/webhook", secretToken: builder.Configuration["TELEGRAM_WEBHOOK_SECRET"]);

app.MapPost("/telegram/webhook", async (HttpRequest request, Update update) =>
{
    var configuredSecret = builder.Configuration["TELEGRAM_WEBHOOK_SECRET"];
    var suppliedSecret = request.Headers["X-Telegram-Bot-Api-Secret-Token"].FirstOrDefault();
    if (!string.IsNullOrWhiteSpace(configuredSecret) &&
        (string.IsNullOrWhiteSpace(suppliedSecret) || suppliedSecret.Length != configuredSecret.Length ||
         !CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(configuredSecret), Encoding.UTF8.GetBytes(suppliedSecret))))
        return Results.Unauthorized();
    if (bot is null || update.Message?.Text is null) return Results.Ok();
    var chatId = update.Message.Chat.Id;
    var text = update.Message.Text.Trim();
    if (text.StartsWith("/start") || text.StartsWith("/app"))
    {
        var markup = string.IsNullOrWhiteSpace(webAppUrl) ? null : new InlineKeyboardMarkup(InlineKeyboardButton.WithWebApp("☕ Открыть кофейню", new WebAppInfo { Url = webAppUrl }));
        await bot.SendMessage(chatId, "☕ Coffee Control\n\nКасса и смены вашей кофейни в одном приложении.", replyMarkup: markup);
    }
    else if (text.StartsWith("/help"))
        await bot.SendMessage(chatId, "/start — открыть Coffee Control\n/app — открыть приложение\n/help — помощь");
    return Results.Ok();
});

app.MapGet("/api/me", async (HttpRequest request, AppDbContext db, TelegramAuth auth, CancellationToken ct) =>
{
    var user = await auth.AuthenticateAsync(request, db, ct);
    return user is null ? Results.Unauthorized() : Results.Ok(new { id = user.Id, user.TelegramId, user.Username, user.FirstName, user.LastName, user.Role });
});

app.MapGet("/api/products", async (AppDbContext db, CancellationToken ct) => Results.Ok(await db.Products.AsNoTracking()
    .Where(product => product.IsActive && product.Category.IsActive)
    .OrderBy(product => product.Category.SortOrder).ThenBy(product => product.SortOrder)
    .Select(product => new
    {
        id = product.Id, name = product.Name, category = product.Category.Name, icon = product.Category.Icon,
        quick = product.IsQuickOrder,
        variants = product.Variants.Where(variant => variant.IsActive).OrderByDescending(variant => variant.IsDefault)
            .Select(variant => new { id = variant.Id, name = variant.Name, price = variant.Price, volumeMl = variant.VolumeMl })
    }).ToListAsync(ct)));

app.MapGet("/api/dashboard", async (HttpRequest request, AppDbContext db, TelegramAuth auth, CancellationToken ct) =>
{
    var user = await auth.AuthenticateAsync(request, db, ct);
    if (user is null) return Results.Unauthorized();
    var shift = await db.Shifts.AsNoTracking()
        .Include(item => item.Orders).ThenInclude(order => order.Payments)
        .Include(item => item.Orders).ThenInclude(order => order.Items)
        .Include(item => item.Orders).ThenInclude(order => order.Items).ThenInclude(item => item.Modifiers)
        .Where(item => item.UserId == user.Id && item.Status == ShiftStatus.Open)
        .OrderByDescending(item => item.OpenedAt).FirstOrDefaultAsync(ct);
    if (shift is null) return Results.Ok(new { me = UserDto(user), currentShift = (object?)null, revenue = 0m, ordersCount = 0, cash = 0m, card = 0m, averageCheck = 0m, recentOrders = Array.Empty<object>() });
    var completed = shift.Orders.Where(order => order.Status == OrderStatus.Completed).ToList();
    var metrics = BusinessRules.CalculateShift(shift.OpeningCash, completed);
    return Results.Ok(new
    {
        me = UserDto(user), currentShift = ShiftDto(shift), metrics.Revenue, metrics.OrdersCount, metrics.Cash, metrics.Card, metrics.AverageCheck,
        recentOrders = completed.OrderByDescending(order => order.CreatedAt).Take(10).Select(OrderDto)
    });
});

app.MapPost("/api/shifts/open", async (HttpRequest request, AppDbContext db, TelegramAuth auth, OpenShiftDto dto, CancellationToken ct) =>
{
    var user = await auth.AuthenticateAsync(request, db, ct);
    if (user is null) return Results.Unauthorized();
    if (dto.OpeningCash < 0) return Results.BadRequest(new { code = "INVALID_CASH", message = "Касса не может быть отрицательной." });
    var existing = await db.Shifts.AsNoTracking().FirstOrDefaultAsync(item => item.UserId == user.Id && item.Status == ShiftStatus.Open, ct);
    if (existing is not null) return Results.Ok(ShiftDto(existing));
    var shift = new Shift { UserId = user.Id, BusinessDate = BusinessClock.Today(), OpeningCash = dto.OpeningCash, ExpectedClosingCash = dto.OpeningCash };
    db.Shifts.Add(shift);
    await db.SaveChangesAsync(ct);
    return Results.Ok(ShiftDto(shift));
});

app.MapPost("/api/shifts/{id:guid}/close", async (Guid id, HttpRequest request, AppDbContext db, TelegramAuth auth, CloseShiftDto dto, CancellationToken ct) =>
{
    var user = await auth.AuthenticateAsync(request, db, ct);
    if (user is null) return Results.Unauthorized();
    if (dto.ActualCash < 0) return Results.BadRequest(new { code = "INVALID_CASH", message = "Касса не может быть отрицательной." });
    var shift = await db.Shifts.Include(item => item.Orders).ThenInclude(order => order.Payments)
        .SingleOrDefaultAsync(item => item.Id == id && item.UserId == user.Id, ct);
    if (shift is null) return Results.NotFound(new { code = "SHIFT_NOT_FOUND", message = "Смена не найдена." });
    if (shift.Status != ShiftStatus.Open) return Results.BadRequest(new { code = "SHIFT_ALREADY_CLOSED", message = "Смена уже закрыта." });
    var metrics = BusinessRules.CalculateShift(shift.OpeningCash, shift.Orders.Where(order => order.Status == OrderStatus.Completed));
    shift.ExpectedClosingCash = metrics.ExpectedCash;
    shift.ActualClosingCash = dto.ActualCash;
    shift.CashDifference = dto.ActualCash - metrics.ExpectedCash;
    shift.ClosedAt = DateTime.UtcNow;
    shift.Status = ShiftStatus.Closed;
    shift.Comment = string.IsNullOrWhiteSpace(dto.Comment) ? null : dto.Comment.Trim()[..Math.Min(dto.Comment.Trim().Length, 500)];
    await db.SaveChangesAsync(ct);
    return Results.Ok(ShiftDto(shift));
});

app.MapPost("/api/orders", async (HttpRequest request, AppDbContext db, TelegramAuth auth, CreateOrderDto dto, CancellationToken ct) =>
{
    var user = await auth.AuthenticateAsync(request, db, ct);
    if (user is null) return Results.Unauthorized();
    if (string.IsNullOrWhiteSpace(dto.RequestId) || dto.RequestId.Length > 100 || dto.Items is null || dto.Items.Count == 0 ||
        dto.Items.Count > 100 || dto.Items.Any(item => item.Quantity is <= 0 or > 100 || item.ModifierAmount < 0 ||
            item.Modifiers?.Any(modifier => !ModifierPrices.ContainsKey(modifier.Name) || modifier.Quantity is <= 0 or > 3) == true) ||
        dto.Payments is null || dto.Payments.Count == 0 || dto.Payments.Any(payment => payment.Amount <= 0))
        return Results.BadRequest(new { code = "INVALID_ORDER", message = "Проверьте позиции и способ оплаты." });
    var existing = await db.Orders.AsNoTracking().Include(order => order.Items).ThenInclude(item => item.Modifiers).Include(order => order.Payments)
        .SingleOrDefaultAsync(order => order.RequestId == dto.RequestId, ct);
    if (existing is not null) return Results.Ok(OrderDto(existing));
    var shift = await db.Shifts.OrderByDescending(item => item.OpenedAt).FirstOrDefaultAsync(item => item.UserId == user.Id && item.Status == ShiftStatus.Open, ct);
    if (shift is null) return Results.BadRequest(new { code = "SHIFT_NOT_OPEN", message = "Откройте смену перед созданием заказа." });
    var variantIds = dto.Items.Select(item => item.VariantId).Distinct().ToArray();
    var variants = await db.Variants.AsNoTracking().Include(variant => variant.Product)
        .Where(variant => variantIds.Contains(variant.Id) && variant.IsActive && variant.Product.IsActive && variant.Product.Category.IsActive)
        .ToDictionaryAsync(variant => variant.Id, ct);
    var order = new Order { ShiftId = shift.Id, UserId = user.Id, RequestId = dto.RequestId.Trim(), Number = (await db.Orders.MaxAsync(item => (long?)item.Number, ct) ?? 0) + 1 };
    foreach (var item in dto.Items)
    {
        if (!variants.TryGetValue(item.VariantId, out var variant)) return Results.BadRequest(new { code = "PRODUCT_NOT_FOUND", message = "Один из товаров больше недоступен. Обновите меню." });
        var modifiers = (item.Modifiers ?? []).GroupBy(modifier => modifier.Name)
            .Select(group => new { Name = group.Key, Quantity = group.Sum(modifier => modifier.Quantity) }).ToList();
        var modifierAmount = modifiers.Sum(modifier => ModifierPrices.Values[modifier.Name] * modifier.Quantity);
        if (item.ModifierAmount != modifierAmount) return Results.BadRequest(new { code = "INVALID_MODIFIERS", message = "Проверьте выбранные добавки." });
        var unitPrice = variant.Price + modifierAmount;
        if (unitPrice < 0) return Results.BadRequest(new { code = "INVALID_PRICE", message = "Цена позиции не может быть отрицательной." });
        var orderItem = new OrderItem { ProductId = variant.ProductId, ProductVariantId = variant.Id, ProductNameSnapshot = variant.Product.Name, VariantNameSnapshot = variant.Name, BasePrice = variant.Price, Quantity = item.Quantity, UnitPrice = unitPrice, TotalPrice = unitPrice * item.Quantity };
        orderItem.Modifiers = modifiers.Select(modifier => new OrderItemModifier { ModifierNameSnapshot = modifier.Name, PriceAdjustmentSnapshot = ModifierPrices.Values[modifier.Name], Quantity = modifier.Quantity }).ToList();
        order.Items.Add(orderItem);
    }
    order.TotalAmount = order.Items.Sum(item => item.TotalPrice);
    if (order.TotalAmount <= 0 || dto.Payments.Sum(payment => payment.Amount) != order.TotalAmount)
        return Results.BadRequest(new { code = "PAYMENT_MISMATCH", message = "Сумма оплаты не совпадает с итогом заказа." });
    order.Payments = dto.Payments.Select(payment => new Payment { PaymentMethod = payment.Method, Amount = payment.Amount }).ToList();
    db.Orders.Add(order);
    shift.ExpectedClosingCash += order.Payments.Where(payment => payment.PaymentMethod == PaymentMethod.Cash).Sum(payment => payment.Amount);
    await db.SaveChangesAsync(ct);
    return Results.Ok(OrderDto(order));
});

app.MapGet("/api/orders", async (HttpRequest request, AppDbContext db, TelegramAuth auth, CancellationToken ct) =>
{
    var user = await auth.AuthenticateAsync(request, db, ct);
    if (user is null) return Results.Unauthorized();
    var orders = await db.Orders.AsNoTracking().Include(order => order.Items).ThenInclude(item => item.Modifiers).Include(order => order.Payments)
        .Where(order => order.UserId == user.Id).OrderByDescending(order => order.CreatedAt).Take(200).ToListAsync(ct);
    return Results.Ok(orders.Select(OrderDto));
});

app.MapGet("/api/analytics", async (string? period, HttpRequest request, AppDbContext db, TelegramAuth auth, CancellationToken ct) =>
{
    var user = await auth.AuthenticateAsync(request, db, ct);
    if (user is null) return Results.Unauthorized();
    var today = BusinessClock.Today();
    var selectedPeriod = period?.ToLowerInvariant() switch { "today" => "today", "month" => "month", _ => "week" };
    var from = selectedPeriod switch { "today" => today, "month" => new DateOnly(today.Year, today.Month, 1), _ => today.AddDays(-6) };
    var periodDays = today.DayNumber - from.DayNumber + 1;
    var rows = await db.Orders.AsNoTracking().Include(order => order.Payments)
        .Where(order => order.UserId == user.Id && order.Status == OrderStatus.Completed && order.Shift.BusinessDate >= from)
        .Select(order => new { order.Shift.BusinessDate, order.TotalAmount, Payments = order.Payments.Select(payment => new { payment.PaymentMethod, payment.Amount }) })
        .ToListAsync(ct);
    var daily = Enumerable.Range(0, periodDays).Select(offset => from.AddDays(offset)).Select(date =>
    {
        var orders = rows.Where(row => row.BusinessDate == date).ToList();
        return new { date, revenue = orders.Sum(order => order.TotalAmount), ordersCount = orders.Count };
    }).ToList();
    return Results.Ok(new
    {
        period = selectedPeriod, periodDays, revenue = rows.Sum(row => row.TotalAmount), ordersCount = rows.Count,
        averageCheck = rows.Count == 0 ? 0 : rows.Average(row => row.TotalAmount),
        cash = rows.SelectMany(row => row.Payments).Where(payment => payment.PaymentMethod == PaymentMethod.Cash).Sum(payment => payment.Amount),
        card = rows.SelectMany(row => row.Payments).Where(payment => payment.PaymentMethod == PaymentMethod.Card).Sum(payment => payment.Amount), daily
    });
});

app.MapFallbackToFile("index.html");
app.Run();

static object UserDto(CoffeeControl.Api.User user) => new { id = user.Id, user.FirstName, user.LastName, user.Username, user.Role };
static object ShiftDto(Shift shift) => new { id = shift.Id, shift.BusinessDate, shift.OpenedAt, shift.ClosedAt, shift.OpeningCash, shift.ExpectedClosingCash, shift.ActualClosingCash, shift.CashDifference, shift.Status, shift.Comment };
static object OrderDto(Order order) => new { id = order.Id, order.Number, order.TotalAmount, order.CreatedAt, status = order.Status.ToString(), payments = order.Payments.Select(payment => new { method = payment.PaymentMethod.ToString(), payment.Amount }), items = order.Items.Select(item => new { name = item.ProductNameSnapshot, variant = item.VariantNameSnapshot, item.Quantity, item.UnitPrice, item.TotalPrice, modifiers = item.Modifiers.Select(modifier => new { name = modifier.ModifierNameSnapshot, modifier.Quantity }) }) };

public record OpenShiftDto(decimal OpeningCash);
public record CloseShiftDto(decimal ActualCash, string? Comment);
public record CreateItemDto(Guid VariantId, int Quantity, decimal ModifierAmount = 0, List<CreateModifierDto>? Modifiers = null);
public record CreateModifierDto(string Name, int Quantity = 1);
public record CreatePaymentDto(PaymentMethod Method, decimal Amount);
public record CreateOrderDto(string RequestId, List<CreateItemDto> Items, List<CreatePaymentDto> Payments);
public partial class Program { }

static class ModifierPrices
{
    public static readonly IReadOnlyDictionary<string, decimal> Values = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase)
    {
        ["Сироп"] = 15m,
        ["Растительное молоко"] = 45m,
        ["Без кофеина"] = 15m
    };
    public static bool ContainsKey(string name) => Values.ContainsKey(name);
}
