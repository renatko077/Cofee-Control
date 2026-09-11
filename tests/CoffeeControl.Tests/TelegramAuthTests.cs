using CoffeeControl.Api;
using Microsoft.Extensions.Configuration;
using System.Collections.Generic;
using Xunit;

namespace CoffeeControl.Tests;

public class TelegramAuthTests
{
    [Fact]
    public void OnlyHeadVariableGrantsAdminRole()
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ADMIN_TELEGRAM_HEAD"] = "100",
            ["ADMIN_TELEGRAM_ID1"] = "200",
            ["ADMIN_TELEGRAM_ID2"] = "300"
        }).Build();
        var auth = new TelegramAuth(configuration);

        Assert.Equal(Role.Admin, auth.ResolveRole(100, null));
        Assert.Equal(Role.Barista, auth.ResolveRole(200, null));
        Assert.Equal(Role.Barista, auth.ResolveRole(300, null));
    }

    [Fact]
    public void HeadCanBeConfiguredByPhone()
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ADMIN_TELEGRAM_HEAD"] = "+380 50 123 45 67",
            ["ADMIN_TELEGRAM_ID1"] = "+380 63 765 43 21"
        }).Build();
        var auth = new TelegramAuth(configuration);

        Assert.Equal(Role.Admin, auth.ResolveRole(1, "+380501234567"));
        Assert.Equal(Role.Barista, auth.ResolveRole(2, "+380637654321"));
    }
}
