# Oyster Rewards

隱私保護的位置獎勵和分析庫，專為保護用戶隱私而設計的地理位置數據處理解決方案。

## 功能

- **位置加密**：使用 ChaCha20Poly1305 進行端到端加密
- **位置驗證**：基於 WiFi 和蜂窩網絡數據進行防欺詐驗證
- **隱私熱點圖**：使用差分隱私技術生成匿名熱點圖
- **位置分析**：識別有意義的位置訪問並生成運動模式報告
- **簡單 API**：易於整合到各種應用程序中

## 安裝

添加以下內容到您的 `Cargo.toml`：

```toml
[dependencies]
oyster-rewards = "0.1.0"
```

## 快速入門

```rust
use oyster_rewards::{
    Location, SensorData, register_location, generate_heatmap, 
    HeatmapRequest, generate_visit_analytics
};

// 註冊位置
let location = Location {
    // 創建您的位置數據...
};
let result = register_location(location);

// 生成熱點圖
let heatmap_request = HeatmapRequest {
    min_lat: 37.7,
    max_lat: 37.8,
    min_lon: -122.5,
    max_lon: -122.4,
    privacy_level: 1.5,
};
let heatmap = generate_heatmap(&heatmap_request);

// 分析位置訪問
let analytics = generate_visit_analytics(&your_request);
```

## 架構

該庫分為以下幾個模塊：

- **models**：數據結構和類型定義
- **crypto**：位置數據加密和解密
- **location**：位置註冊和驗證
- **heatmap**：熱點圖生成和差分隱私
- **analytics**：位置訪問分析和運動模式

## 隱私保護

我們採用以下技術來保護用戶隱私：

1. **端到端加密**：所有位置數據都使用強加密進行保護
2. **差分隱私**：熱點圖和聚合分析添加校準噪聲，防止重識別
3. **本地驗證**：位置驗證在設備端進行，最小化數據共享
4. **最少權限**：只收集和存儲必要的信息

## 示例

查看 `examples` 目錄中的完整示例：

- **demo.rs**：基本功能演示
- **heatmap_demo.rs**：熱點圖生成示例
- **analytics_demo.rs**：位置分析示例

運行示例：

```
cargo run --example demo
```

## 測試

運行測試：

```
cargo test
```

## 基準測試

運行基準測試：

```
cargo bench
```

## 貢獻

歡迎貢獻！請先查看 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 許可證

MIT 或 Apache-2.0，由您選擇。

## Deployment to Oyster CVM

This project includes scripts for easy deployment to Oyster CVM.

### Prerequisites

1. Install the Oyster CVM CLI
2. Ensure you have Docker installed and configured
3. Have a wallet private key for Oyster CVM deployments

### Deployment

To deploy the application, use the provided deployment script:

```bash
./deploy.sh <wallet-private-key> [duration_minutes]
```

Options:
- `<wallet-private-key>`: Required. Your wallet private key for authentication
- `[duration_minutes]`: Optional. Duration of deployment in minutes (default: 15)

You can also specify the deployment action as a third parameter:
- `./deploy.sh <key> <minutes> build` - Only build and push the Docker image
- `./deploy.sh <key> <minutes> deploy` - Only deploy (uses existing Docker image)
- `./deploy.sh <key> <minutes> all` - Build, push, and deploy

### Stopping a Deployment

To stop a running deployment, use the stop script:

```bash
./stop.sh <wallet-private-key> [deployment-id]
```

If you don't provide a deployment ID, the script will list active deployments and prompt you to select one.

### Docker Image

The application uses the Docker image `kidneyweakx/oyster-rewards:latest`. 