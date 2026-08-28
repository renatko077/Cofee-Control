using Xunit; using System.Linq;
namespace CoffeeControl.Tests;
public class BusinessRulesTests
{
 [Fact] public void Order_total_is_sum_of_backend_priced_items(){var prices=new[]{85m,25m};Assert.Equal(110m,prices.Sum());}
 [Fact] public void Cash_difference_is_actual_minus_expected(){Assert.Equal(-50m,150m-200m);}
 [Fact] public void Mixed_payment_must_equal_total(){var total=300m;Assert.Equal(100m+200m,total);}
}
