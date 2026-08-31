using Microsoft.EntityFrameworkCore;

namespace CoffeeControl.Api;
public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
 public DbSet<User> Users => Set<User>(); public DbSet<Shift> Shifts => Set<Shift>(); public DbSet<ProductCategory> Categories => Set<ProductCategory>(); public DbSet<Product> Products => Set<Product>(); public DbSet<ProductVariant> Variants => Set<ProductVariant>(); public DbSet<Order> Orders => Set<Order>(); public DbSet<OrderItem> OrderItems => Set<OrderItem>(); public DbSet<Payment> Payments => Set<Payment>(); public DbSet<WriteOff> WriteOffs => Set<WriteOff>();
 protected override void OnModelCreating(ModelBuilder b) { b.Entity<User>().HasIndex(x=>x.TelegramId).IsUnique(); b.Entity<Order>().HasIndex(x=>x.RequestId).IsUnique(); b.Entity<Order>().HasIndex(x=>x.Number).IsUnique(); b.Entity<Shift>().HasIndex(x=>new{x.UserId,x.BusinessDate}); b.Entity<Shift>().Property(x=>x.OpeningCash).HasPrecision(12,2); b.Entity<Shift>().Property(x=>x.ExpectedClosingCash).HasPrecision(12,2); b.Entity<Order>().Property(x=>x.TotalAmount).HasPrecision(12,2); b.Entity<ProductVariant>().Property(x=>x.Price).HasPrecision(12,2); b.Entity<Payment>().Property(x=>x.Amount).HasPrecision(12,2); b.Entity<OrderItem>().Property(x=>x.BasePrice).HasPrecision(12,2); b.Entity<OrderItem>().Property(x=>x.UnitPrice).HasPrecision(12,2); b.Entity<OrderItem>().Property(x=>x.TotalPrice).HasPrecision(12,2); b.Entity<OrderItemModifier>().Property(x=>x.PriceAdjustmentSnapshot).HasPrecision(12,2); }
}

public static class DbSeeder
{
    public static async Task SeedAsync(AppDbContext db, CancellationToken ct)
    {
        var categories = new (string Name, string Icon, int SortOrder)[]
        {
            ("Кофе", "☕", 0), ("Холодные напитки", "🧊", 1), ("Чай", "🍵", 2),
            ("Еда", "🥐", 3), ("Десерты", "🍰", 4), ("Снеки", "🍫", 5)
        };

        var categoryMap = new Dictionary<string, ProductCategory>();
        foreach (var item in categories)
        {
            var category = await db.Categories.FirstOrDefaultAsync(x => x.Name == item.Name, ct);
            if (category is null)
            {
                category = new ProductCategory { Name = item.Name, Icon = item.Icon, SortOrder = item.SortOrder };
                db.Categories.Add(category);
            }
            else
            {
                category.Icon = item.Icon;
                category.SortOrder = item.SortOrder;
                category.IsActive = true;
            }
            categoryMap[item.Name] = category;
        }

        await db.SaveChangesAsync(ct);

        // Цены и ассортимент сняты с фотографий витрины и меню. Метод идемпотентен,
        // поэтому при следующем деплое добавятся только отсутствующие позиции.
        var items = new (string Name, string Category, decimal Price, string Variant, int? Volume, bool Quick)[]
        {
            ("Эспрессо", "Кофе", 60, "M", null, true),
            ("Американо", "Кофе", 65, "M", null, true),
            ("Американо с молоком", "Кофе", 85, "M", null, true),
            ("Капучино", "Кофе", 80, "M", null, true),
            ("Флэт уайт", "Кофе", 85, "M", null, true),
            ("Латте", "Кофе", 95, "M", null, true),
            ("Дабл капучино", "Кофе", 95, "M", null, false),
            ("Раф", "Кофе", 95, "M", null, true),
            ("Глинтвейн", "Кофе", 110, "M", null, false),
            ("Какао", "Кофе", 70, "M", null, false),
            ("Горячий шоколад", "Кофе", 75, "M", null, false),
            ("Матча лате", "Кофе", 90, "M", null, false),
            ("Лимонад", "Холодные напитки", 95, "Стандарт", null, true),
            ("Лимонад Моршинська", "Холодные напитки", 35, "Стандарт", null, false),
            ("Shake", "Холодные напитки", 30, "Стандарт", null, false),
            ("Mojo", "Холодные напитки", 30, "Стандарт", null, false),
            ("Сок", "Холодные напитки", 25, "Стандарт", null, false),
            ("Мохито", "Холодные напитки", 120, "Стандарт", null, false),
            ("Эспрессо-тоник", "Холодные напитки", 120, "Стандарт", null, false),
            ("Айс латте", "Холодные напитки", 120, "Стандарт", null, false),
            ("Матча айс", "Холодные напитки", 120, "Стандарт", null, false),
            ("Pepsi", "Холодные напитки", 35, "330 мл", 330, false),
            ("Fanta", "Холодные напитки", 35, "330 мл", 330, false),
            ("Coca-Cola", "Холодные напитки", 35, "330 мл", 330, false),
            ("Coca-Cola Zero", "Холодные напитки", 35, "330 мл", 330, false),
            ("Red Bull", "Холодные напитки", 30, "250 мл", 250, false),
            ("Burn", "Холодные напитки", 55, "250 мл", 250, false),
            ("Non Stop Original 250 мл", "Холодные напитки", 40, "250 мл", 250, false),
            ("Non Stop Original 500 мл", "Холодные напитки", 60, "500 мл", 500, false),
            ("Extra Life", "Холодные напитки", 50, "500 мл", 500, false),
            ("Вода", "Холодные напитки", 45, "500 мл", 500, false),
            ("Чай", "Чай", 70, "Стандарт", null, true),
            ("Маффин", "Еда", 50, "1 шт.", null, true),
            ("Пончик", "Еда", 50, "1 шт.", null, true),
            ("Кейк-попс", "Десерты", 45, "1 шт.", null, false),
            ("Вафельная трубочка", "Десерты", 35, "1 шт.", null, false),
            ("Печенье", "Десерты", 30, "1 шт.", null, false),
            ("Брауни", "Десерты", 25, "1 шт.", null, false),
            ("Пончик 55", "Еда", 55, "1 шт.", null, false),
            ("Шоколадный батончик", "Снеки", 20, "1 шт.", null, false),
            ("M&M's", "Снеки", 45, "1 уп.", null, false),
            ("Kinder", "Снеки", 75, "1 шт.", null, false),
            ("Орешек", "Снеки", 25, "1 шт.", null, false),
            ("Bob Snail 80", "Снеки", 80, "1 уп.", null, false),
            ("Bob Snail 100", "Снеки", 100, "1 уп.", null, false),
            ("Метеорит", "Снеки", 40, "1 шт.", null, false),
            ("Мёд", "Снеки", 15, "1 порция", null, false),
            ("Зефир", "Снеки", 35, "1 шт.", null, false),
            ("Коса", "Снеки", 30, "1 шт.", null, false),
            ("Кукурузные палочки", "Снеки", 35, "1 уп.", null, false),
        };

        var sortByCategory = items.GroupBy(x => x.Category).ToDictionary(x => x.Key, x => 0);
        foreach (var item in items)
        {
            var category = categoryMap[item.Category];
            var product = await db.Products.Include(x => x.Variants)
                .FirstOrDefaultAsync(x => x.CategoryId == category.Id && x.Name == item.Name, ct);
            if (product is null)
            {
                product = new Product { Name = item.Name, Category = category, IsQuickOrder = item.Quick, SortOrder = sortByCategory[item.Category]++ };
                product.Variants.Add(new ProductVariant { Name = item.Variant, VolumeMl = item.Volume, Price = item.Price, IsDefault = true });
                db.Products.Add(product);
            }
            else if (!product.Variants.Any(x => x.Name == item.Variant))
            {
                // Обновляем одноимённые позиции из старого MVP-seed
                // (у них был единственный вариант «Стандарт»).
                var legacy = product.Variants.Count == 1 && product.Variants[0].Name == "Стандарт" ? product.Variants[0] : null;
                if (legacy is not null)
                {
                    legacy.Name = item.Variant;
                    legacy.VolumeMl = item.Volume;
                    legacy.Price = item.Price;
                }
                else
                    product.Variants.Add(new ProductVariant { Name = item.Variant, VolumeMl = item.Volume, Price = item.Price, IsDefault = product.Variants.Count == 0 });
            }
            product.IsActive = true;
            product.IsQuickOrder = item.Quick;
        }

        await db.SaveChangesAsync(ct);
    }
}
