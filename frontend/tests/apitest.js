import { performance } from 'perf_hooks';
import { writeFileSync } from 'fs';

const baseUrl = 'http://nginx/api/v1';

const endpoints = [
  '/restaurants',
  '/restaurants/store-101',
  '/map/facilities',
];

const loop = 10;

(async () => {
  let output = '';

  for (const endpoint of endpoints) {
    let sumTime = 0;

    output += `=== ${endpoint} ===\n`;
    console.log(`\n=== ${endpoint} ===`);

    for (let i = 0; i < loop; i++) {
      const startTime = performance.now();

      const response = await fetch(`${baseUrl}${endpoint}`, {
        headers: {
          Accept: 'application/json',
        },
      });

      const endTime = performance.now();
      const responseTime = (endTime - startTime) / 1000;

      sumTime += responseTime;

      const line = `#${i + 1} Status: ${response.status}, Time: ${responseTime.toFixed(4)} sec`;

      console.log(line);
      output += line + '\n';
    }

    const total = `合計: ${sumTime.toFixed(4)} sec`;
    const average = `平均: ${(sumTime / loop).toFixed(4)} sec`;

    console.log(total);
    console.log(average);

    output += total + '\n';
    output += average + '\n\n';
  }

  // ファイルへ保存
  writeFileSync(
    'tests/result/api_benchmark_result.txt',
    output,
    'utf8'
  );
  console.log('\n結果を api_benchmark_result.txt に保存しました。');
})();