using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CoffeeControl.Api.Migrations
{
    /// <inheritdoc />
    public partial class SyncOrderModel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_OrderItemModifier_OrderItems_OrderItemId",
                table: "OrderItemModifier");

            migrationBuilder.DropPrimaryKey(
                name: "PK_OrderItemModifier",
                table: "OrderItemModifier");

            migrationBuilder.RenameTable(
                name: "OrderItemModifier",
                newName: "OrderItemModifiers");

            migrationBuilder.RenameIndex(
                name: "IX_OrderItemModifier_OrderItemId",
                table: "OrderItemModifiers",
                newName: "IX_OrderItemModifiers_OrderItemId");

            migrationBuilder.AddPrimaryKey(
                name: "PK_OrderItemModifiers",
                table: "OrderItemModifiers",
                column: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_OrderItemModifiers_OrderItems_OrderItemId",
                table: "OrderItemModifiers",
                column: "OrderItemId",
                principalTable: "OrderItems",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_OrderItemModifiers_OrderItems_OrderItemId",
                table: "OrderItemModifiers");

            migrationBuilder.DropPrimaryKey(
                name: "PK_OrderItemModifiers",
                table: "OrderItemModifiers");

            migrationBuilder.RenameTable(
                name: "OrderItemModifiers",
                newName: "OrderItemModifier");

            migrationBuilder.RenameIndex(
                name: "IX_OrderItemModifiers_OrderItemId",
                table: "OrderItemModifier",
                newName: "IX_OrderItemModifier_OrderItemId");

            migrationBuilder.AddPrimaryKey(
                name: "PK_OrderItemModifier",
                table: "OrderItemModifier",
                column: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_OrderItemModifier_OrderItems_OrderItemId",
                table: "OrderItemModifier",
                column: "OrderItemId",
                principalTable: "OrderItems",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
