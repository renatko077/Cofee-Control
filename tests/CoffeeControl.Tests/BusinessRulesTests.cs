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

    [Theory]
    [InlineData(650, 660, -10)]
    [InlineData(660, 660, 0)]
    [InlineData(700, 660, 40)]
    public void Cash_difference_is_actual_minus_expected(decimal actual, decimal expected, decimal difference)
        => Assert.Equal(difference, actual - expected);

    private static Order Order(decimal total, OrderStatus status, params (PaymentMethod method, decimal amount)[] payments)
        => new() { TotalAmount = total, Status = status, Payments = payments.Select(payment => new Payment { PaymentMethod = payment.method, Amount = payment.amount }).ToList() };
}
