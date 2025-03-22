# Oyster Rewards API

這是一個基於Actix Web的API服務，提供位置獎勵和分析功能。

## API端點

- `GET /` - API信息
- `GET /health` - 健康檢查
- `POST /api/v1/locations` - 註冊新的位置
- `GET /api/v1/locations/{id}` - 獲取特定位置詳情
- `POST /api/v1/heatmap` - 生成熱點圖
- `POST /api/v1/analytics` - 生成訪問分析

## 安裝與運行

### 使用Docker Compose

1. 確保您已安裝Docker和Docker Compose

2. 在項目根目錄下運行：

```bash
docker-compose up -d
```

3. API將在`http://localhost:8080`上可用

### 手動構建和運行

1. 構建API二進制文件：

```bash
cargo build --release --bin oyster-api
```

2. 運行二進制文件：

```bash
./target/release/oyster-api
```

## 環境變量

可以通過`.env`文件或環境變量設置以下配置：

- `HOST`: 服務器主機 (默認: 0.0.0.0)
- `PORT`: 服務器端口 (默認: 8080)
- `RUST_LOG`: 日誌級別 (默認: info)

## Docker鏡像構建

要單獨構建Docker鏡像：

```bash
docker build -t oyster-rewards-api .
```

運行構建的鏡像：

```bash
docker run -p 8080:8080 oyster-rewards-api
```

## API請求示例

### 註冊位置

```bash
curl -X POST http://localhost:8080/api/v1/locations \
  -H "Content-Type: application/json" \
  -d '{
    "lat": 37.7749,
    "lon": -122.4194,
    "timestamp": "2023-06-15T14:30:00Z",
    "user_id": "user123",
    "device_id": "device456",
    "sensors": {
      "wifi_networks": [],
      "cell_towers": [],
      "accelerometer": [0.1, 0.2, 9.8],
      "gyroscope": [0.01, 0.02, 0.03],
      "is_mock_location": false,
      "additional_data": {}
    }
  }'
```

### 生成熱點圖

```bash
curl -X POST http://localhost:8080/api/v1/heatmap \
  -H "Content-Type: application/json" \
  -d '{
    "min_lat": 37.75,
    "max_lat": 37.8,
    "min_lon": -122.45,
    "max_lon": -122.4,
    "privacy_level": 1.5
  }'
``` 