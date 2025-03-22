use criterion::{black_box, criterion_group, criterion_main, Criterion};
use oyster_rewards::{HeatmapRequest, generate_heatmap, generate_synthetic_heatmap};

fn heatmap_benchmark(c: &mut Criterion) {
    let mut group = c.benchmark_group("Heatmap Generation");

    let request = HeatmapRequest {
        min_lat: 37.75,
        max_lat: 37.8,
        min_lon: -122.45,
        max_lon: -122.4,
        privacy_level: 1.5,
    };

    group.bench_function("real_heatmap", |b| {
        b.iter(|| generate_heatmap(black_box(&request)))
    });

    group.bench_function("synthetic_heatmap", |b| {
        b.iter(|| generate_synthetic_heatmap(black_box(&request)))
    });

    group.finish();
}

criterion_group!(benches, heatmap_benchmark);
criterion_main!(benches); 