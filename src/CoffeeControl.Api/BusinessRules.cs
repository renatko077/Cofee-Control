namespace CoffeeControl.Api;

public sealed record ShiftMetrics(decimal Revenue, int OrdersCount, decimal Cash, decimal Card, decimal AverageCheck, decimal ExpectedCash);

public static class BusinessRules
{
    public static readonly IReadOnlyDictionary<string, int> CoffeePortionsPerUnit = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)
    {
        ["Американо"] = 2, ["Американо с молоком"] = 2, ["Эспрессо"] = 2, ["Капучино"] = 1, ["Капучинно"] = 1,
        ["Флэт уайт"] = 2, ["Флет"] = 2, ["Латте"] = 1, ["Дабл капучино"] = 2,
        ["Дабл кап"] = 2, ["Раф"] = 1, ["Лунго"] = 2, ["Лунга"] = 2,
        ["Айс латте"] = 1, ["Хорнет"] = 1, ["Эспрессо-тоник"] = 1, ["Эспресс тоник"] = 1
    };

    private static readonly HashSet<string> CupProducts = new(StringComparer.OrdinalIgnoreCase)
    {
        "Американо", "Американо с молоком", "Эспрессо", "Капучино", "Капучинно", "Флэт уайт", "Флет",
        "Латте", "Дабл капучино", "Дабл кап", "Раф", "Лунго", "Лунга", "Айс латте", "Хорнет",
        "Эспрессо-тоник", "Эспресс тоник", "Глинтвейн", "Какао", "Горячий шоколад", "Матча лате",
        "Матча айс", "Лимонад", "Мохито", "Чай"
    };

    public static int GetCoffeePortions(string productName, int quantity)
        => CoffeePortionsPerUnit.TryGetValue(productName, out var portions) ? portions * quantity : 0;

    public static bool UsesCup(string productName) => CupProducts.Contains(productName);

    public static ShiftMetrics CalculateShift(decimal openingCash, IEnumerable<Order> orders)
    {
        var completed = orders.Where(order => order.Status == OrderStatus.Completed).ToList();
        var revenue = completed.Sum(order => order.TotalAmount);
        var cash = completed.SelectMany(order => order.Payments).Where(payment => payment.PaymentMethod == PaymentMethod.Cash).Sum(payment => payment.Amount);
        var card = completed.SelectMany(order => order.Payments).Where(payment => payment.PaymentMethod == PaymentMethod.Card).Sum(payment => payment.Amount);
        return new ShiftMetrics(revenue, completed.Count, cash, card, completed.Count == 0 ? 0 : revenue / completed.Count, openingCash + cash);
    }
}

public static class BusinessClock
{
    private static readonly TimeZoneInfo Zone = ResolveZone();
    public static DateOnly Today() => DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, Zone));

    private static TimeZoneInfo ResolveZone()
    {
        var configured = Environment.GetEnvironmentVariable("BUSINESS_TIME_ZONE") ?? "Europe/Vilnius";
        try { return TimeZoneInfo.FindSystemTimeZoneById(configured); }
        catch (TimeZoneNotFoundException) { return TimeZoneInfo.Utc; }
        catch (InvalidTimeZoneException) { return TimeZoneInfo.Utc; }
    }
}
