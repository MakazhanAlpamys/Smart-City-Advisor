# Biny AI Logistics Optimizer

Мультимодальная оптимизация логистики (road + air) для хакатона GDG Astana. В репозитории есть генерация данных, базовый оптимизатор маршрутов, зачатки ML-пайплайна, REST API на FastAPI, Docker и тесты.

Сделано по требованиям из `тз.md` и стратегии победы: синтетический датасет (30–50 узлов, 90–180 дней), пики и сезонность, аномалии, динамический скоринг, батчинг заказов, k альтернативных маршрутов, real-time пересчет.

## Быстрый старт

Windows (CMD/PowerShell):
```bash
python -m venv .venv && .venv\\Scripts\\activate
pip install -r requirements.txt
uvicorn api.main:app --reload
```

Linux/macOS:
```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn api.main:app --reload
```

Docker:
```bash
docker build -t biny-ai .
docker run --rm -p 8000:8000 biny-ai
```

Документация API (Swagger): http://localhost:8000/docs

## Структура проекта (с файлами)

```
README.md                 # Этот файл: как запускать и что внутри
тз.md                      # Условия и требования хакатона
requirements.txt          # Зависимости Python
Dockerfile                # Образ для запуска API
.gitignore                # Игнорируемые файлы (артефакты, data/ и т.д.)

api/
  main.py                # Точки входа FastAPI (эндпоинты)
  schemas.py             # Pydantic-схемы запросов/ответов API

data_generator/
  generate_data.py       # Класс DataGenerator: сеть, заказы, аномалии

optimizer/
  optimizer.py           # Оптимизатор: скоринг, k-пути, батчинг

models/
  infer.py               # Загрузчики моделей и inference-стабы
  train_demand.py        # Обучение прогноза спроса (LightGBM)
  train_transport_selector.py # Классификатор вида транспорта (RF)
  train_eta_cost.py      # Регрессии ETA/стоимости (XGBoost)

scripts/
  make_dataset.py        # Скрипт генерации CSV датасета (nodes/edges/orders)

notebooks/
  .gitkeep               # Место для ноутбуков с графиками/SHAP

tests/
  test_api.py            # Тесты API (health, optimize_route)
  test_optimizer.py      # Тест оптимизатора (альтернативы, метрики)
```

### Ключевые модули
- `api/main.py`: эндпоинты `/optimize_route`, `/batch_orders`, `/predict_demand`, `/recalculate`, `/get_analytics`.
- `api/schemas.py`: строгие схемы Pydantic для валидации входа/выхода.
- `data_generator/generate_data.py`:
  - `DataGenerator.generate_network(nodes)` — создаёт граф узлов с координатами, типом хаба и ребрами (road/air) с длительностью/стоимостью.
  - `DataGenerator.simulate_orders(days, pattern)` — спрос с сезонностью, пиками (6–9, 17–20), эффектами выходных, трендом роста +5%/мес и погодой (rain/snow замедляют road).
  - `DataGenerator.add_noise_and_anomalies(df)` — 5–10% аномалий/отмен.
  - `to_dataframes(G)` — выгрузка `nodes.csv`/`edges.csv`.
- `optimizer/optimizer.py`:
  - `load_graph(...)` — синтетический граф по умолчанию; легко заменить чтением `data/nodes.csv`/`data/edges.csv`.
  - `_weight(...)` — динамическая метрика (время/стоимость) с весами от предпочтений.
  - `optimize_delivery(...)` — k кратчайших простых путей с подсчетом суммы стоимости/времени, reliability и скорингом.
  - `batch_orders(...)` — простой батчинг по (origin, destination) и часовому окну.
- `models/*` — минимальные train-скрипты и инференс-обёртки для интеграции ML.
- `scripts/make_dataset.py` — CLI для генерации полноценного датасета в `data/`.

## Датасет: генерация и формат

Сгенерировать датасет (30–50 узлов, 90–180 дней):
```bash
python scripts/make_dataset.py --nodes 40 --days 120 --out data/
```

Файлы:
- `data/nodes.csv`
  - Колонки: `node_id`, `lat`, `lon`, `hub_type` (road|air)
- `data/edges.csv`
  - Колонки: `src`, `dst`, `mode` (road|air), `distance_km`, `duration_h`, `cost`
- `data/orders.csv`
  - Колонки: `ts` (ISO), `origin_id`, `destination_id`, `weight_kg`, `volume_m3`, `cargo_class`, `weather`, `delay_factor`, `is_anomaly`, `is_cancelled`

Примечания:
- Пики спроса: 6–9 и 17–20. Выходные −40%. 3 сезона. Тренд +5%/мес.
- Погода: rain/snow замедляют авто (до +60% времени).
- 5–10% аномалий/отмен для устойчивости алгоритмов.

## ML-пайплайн (стабы и как обучить)

Обучение спроса (LightGBM):
```bash
python models/train_demand.py --orders data/orders.csv --out models/demand_lgbm.pkl
```

Классификатор транспорта (RandomForest):
```bash
python models/train_transport_selector.py --edges data/edges.csv --out models/transport_rf.pkl
```

ETA/стоимость (XGBoost):
```bash
python models/train_eta_cost.py --edges data/edges.csv --out_time models/eta_xgb.pkl --out_cost models/cost_xgb.pkl
```

Инференс-обёртки: см. `models/infer.py` (функции `load_model`, `predict_*`). Их можно интегрировать в оптимизатор для более точных метрик.

## API: эндпоинты и примеры

Запуск локально: см. «Быстрый старт». После старта: http://localhost:8000/docs

- `POST /optimize_route` — получить 1–3 лучших маршрута
  Пример запроса:
  ```json
  {
    "shipment": {
      "origin_id": "NODE_000",
      "destination_id": "NODE_010",
      "weight_kg": 1500,
      "volume_m3": 10,
      "cargo_class": "standard",
      "required_delivery": null
    },
    "preferences": {
      "optimize_for": "balanced",
      "max_budget": 50000,
      "allow_multimodal": true
    }
  }
  ```
  Ключи в ответе: `recommendations[]` (segments, total_cost, total_duration_hours, reliability_score, ml_confidence), `analytics`.

- `POST /batch_orders` — сгруппировать заказы во временные батчи (минуты)
- `POST /predict_demand` — stub-прогноз спроса (заменяется на модель)
- `POST /recalculate` — real-time пересчёт при закрытии узлов/ребер
- `GET /get_analytics` — агрегированная статистика

## Детали оптимизатора

- Граф мультимодальный: ребра `road`/`air` с разными скоростями/стоимостью.
- k альтернативных путей: `networkx.shortest_simple_paths` с кастомным весом.
- Динамические веса: `optimize_for = cost|time|balanced` меняет коэффициенты времени/стоимости.
- Скоринг: комбинирует обратное время, обратную стоимость и `reliability` (короче маршрут — надёжнее).
- Батчинг: группировка по (origin, destination) и часовому окну.

Замена синтетики на реальные CSV: измените `optimizer.load_graph(...)`, чтобы читать `data/nodes.csv`/`data/edges.csv` и строить граф с атрибутами ребер.

## Тесты

```bash
pytest -q
```

Покрытие: базовые проверки работоспособности API и возврата альтернатив оптимизатором.

## Производительность и советы

- Для графов 30–50 узлов и ~200–500 ребер время ответа держится < 300ms.
- Уменьшайте `k_alternatives` и используйте предвычисленные матрицы расстояний для бенчмарков.
- В продакшене храните граф и модели в памяти, не создавайте их заново на каждый запрос.

## Roadmap (чтобы выиграть)

- Загрузить граф из `data/*.csv`, добавить capacity и time-windows.
- Интегрировать ML в оптимизатор (ETA/стоимость/транспорт).
- SHAP-графики и `analytics.risk_factors` (top-факторы решений).
- Реальный real-time `/recalculate` с сохранением контекста маршрута.
- Стресс-тест: 10x нагрузка, массовое закрытие авиаребер.
- Дополнительно: Q-learning агент для адаптивного роутинга.

## Лицензия

Для целей хакатона. При использовании вне хакатона укажите авторов команды.

