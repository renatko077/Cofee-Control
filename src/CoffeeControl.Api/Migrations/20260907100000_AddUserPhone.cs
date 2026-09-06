using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CoffeeControl.Api.Migrations;

public partial class AddUserPhone : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.AddColumn<string>("Phone", "Users", type: "text", nullable: true);
    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.DropColumn("Phone", "Users");
}
