# Coffee Control

Мобильная Telegram Mini App и бот для ежедневной работы баристы: смены, касса, быстрые заказы, оплата наличными/картой, история и dashboard.

## Структура

- `src/CoffeeControl.Api` — ASP.NET Core API, EF Core/PostgreSQL, Telegram auth и раздача Mini App.
- `frontend` — React + TypeScript + Vite. Сборка попадает в `src/CoffeeControl.Api/wwwroot`.
- `tests` — критические денежные правила.

## Локальный запуск

Нужны .NET 10 SDK, Node.js 22 и PostgreSQL. В `frontend` выполните `npm install; npm run build`, затем из корня `dotnet run --project src/CoffeeControl.Api`.

По умолчанию локально используется `Host=localhost;Database=coffeecontrol;Username=postgres;Password=postgres`. В Development Telegram auth допускает dev-пользователя; в Production initData обязателен.

## Environment Variables

`DATABASE_URL` — Railway PostgreSQL URL (`postgresql://...`) или обычная Npgsql connection string.

`TELEGRAM_BOT_TOKEN` — token от BotFather. `TELEGRAM_BOT_USERNAME` — username бота. `TELEGRAM_WEBAPP_URL` — публичный HTTPS URL приложения. `ADMIN_TELEGRAM_IDS` — Telegram ID администраторов через запятую. `ASPNETCORE_ENVIRONMENT=Production`. `BUSINESS_TIME_ZONE` — часовой пояс бизнес-дня (по умолчанию `Europe/Vilnius`). Опционально: `APP_BASE_URL`, `LOG_LEVEL`.

## BotFather

1. Откройте `@BotFather`, `/newbot`, задайте имя и username.
2. Скопируйте token в Railway variable `TELEGRAM_BOT_TOKEN`.
3. В `/setmenubutton` выберите бота, задайте текст `Открыть кофейню` и URL Railway.
4. В `/setcommands` добавьте `start - открыть Coffee Control`, `app - открыть приложение`, `help - помощь`.
5. URL должен быть HTTPS и совпадать с `TELEGRAM_WEBAPP_URL`.

## Railway

1. Push репозиторий в GitHub.
2. Railway → New Project → Deploy from GitHub repo.
3. Add PostgreSQL.
4. В Variables добавьте перечисленные выше переменные. `DATABASE_URL` возьмите из PostgreSQL reference variable или вставьте connection URL.
5. Нажмите Deploy. Railway передаст `PORT`; контейнер слушает его автоматически.
6. Проверьте `https://<домен>/health` — ожидается HTTP 200.
7. Укажите этот домен в BotFather и в `TELEGRAM_WEBAPP_URL`.

EF Core выполняет `Database.MigrateAsync()` при старте. Для MVP предполагается один Railway instance. Seed создаёт базовые категории и продукты при первом запуске.

## API и безопасность

Frontend передаёт `X-Telegram-Init-Data`; backend проверяет HMAC по официальному алгоритму Telegram, создаёт пользователя и назначает Admin только по `ADMIN_TELEGRAM_IDS`. Цены frontend не доверяются: заказ передаёт только variant IDs, итог рассчитывается из PostgreSQL. `RequestId` защищает от double submit.

## Ограничения MVP

В этой версии нет acquiring/POS, фискализации, полноценного склада и multi-shop. Базовый write-off entity предусмотрен для расширения. Для production рекомендуется добавить webhook bot commands и отдельную миграционную job при масштабировании больше одного instance.
