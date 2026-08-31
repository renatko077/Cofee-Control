using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CoffeeControl.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCoffeeUsage : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "CoffeePortions",
                table: "OrderItems",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "DecafPackets",
                table: "OrderItems",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CoffeePortions",
                table: "OrderItems");

            migrationBuilder.DropColumn(
                name: "DecafPackets",
                table: "OrderItems");
        }
    }
}
