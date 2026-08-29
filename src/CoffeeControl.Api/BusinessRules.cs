namespace CoffeeControl.Api;

public sealed record ShiftMetrics(decimal Revenue, int OrdersCount, decimal Cash, decimal Card, decimal AverageCheck, decimal ExpectedCash);

public static class BusinessRules
{
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
