using CoffeeControl.Api;
using System.Linq;
using Xunit;

namespace CoffeeControl.Tests;

public class BusinessRulesTests
{
    [Fact]
    public void Shift_metrics_include_only_completed_orders()
    {
        var orders = new[]
        {
            Order(110m, OrderStatus.Completed, (PaymentMethod.Cash, 110m)),
            Order(200m, OrderStatus.Completed, (PaymentMethod.Cash, 50m), (PaymentMethod.Card, 150m)),
            Order(999m, OrderStatus.Cancelled, (PaymentMethod.Cash, 999m))
        };
        var result = BusinessRules.CalculateShift(500m, orders);
        Assert.Equal(310m, result.Revenue);
        Assert.Equal(2, result.OrdersCount);
        Assert.Equal(160m, result.Cash);
        Assert.Equal(150m, result.Card);
        Assert.Equal(155m, result.AverageCheck);
        Assert.Equal(660m, result.ExpectedCash);
    }

    [Fact]
    public void Empty_shift_keeps_opening_cash_and_zero_average()
    {
        var result = BusinessRules.CalculateShift(375m, []);
        Assert.Equal(0m, result.Revenue);
        Assert.Equal(0m, result.AverageCheck);
        Assert.Equal(375m, result.ExpectedCash);
    }

    [Fact]
    public void Card_sales_do_not_change_expected_cash_in_drawer()
    {
        var result = BusinessRules.CalculateShift(500m,
        [
            Order(240m, OrderStatus.Completed, (PaymentMethod.Card, 240m)),
            Order(125.50m, OrderStatus.Completed, (PaymentMethod.Cash, 125.50m))
        ]);

        Assert.Equal(125.50m, result.Cash);
        Assert.Equal(240m, result.Card);
        Assert.Equal(625.50m, result.ExpectedCash);
    }

    [Theory]
    [InlineData(650, 660, -10)]
    [InlineData(660, 660, 0)]
    [InlineData(700, 660, 40)]
    public void Cash_difference_is_actual_minus_expected(decimal actual, decimal expected, decimal difference)
        => Assert.Equal(difference, actual - expected);

    [Theory]
    [InlineData("Американо", 1, 2)]
    [InlineData("Эспрессо", 2, 4)]
    [InlineData("Капучино", 3, 3)]
    [InlineData("Флэт уайт", 2, 4)]
    [InlineData("Дабл капучино", 1, 2)]
    [InlineData("Айс латте", 2, 2)]
    [InlineData("Эспрессо-тоник", 1, 1)]
    [InlineData("Брауни", 4, 0)]
    public void Coffee_portions_follow_menu_recipe(string product, int quantity, int expected)
        => Assert.Equal(expected, BusinessRules.GetCoffeePortions(product, quantity));

    [Theory]
    [InlineData("Латте", true)]
    [InlineData("Чай", false)]
    [InlineData("Горячий шоколад", false)]
    [InlineData("Coca-Cola", false)]
    [InlineData("Маффин", false)]
    public void Cup_count_includes_prepared_drinks_only(string product, bool expected)
        => Assert.Equal(expected, BusinessRules.UsesCup(product));

    private static Order Order(decimal total, OrderStatus status, params (PaymentMethod method, decimal amount)[] payments)
        => new() { TotalAmount = total, Status = status, Payments = payments.Select(payment => new Payment { PaymentMethod = payment.method, Amount = payment.amount }).ToList() };
}
