// vite.config.ts
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import { resolve } from 'node:path'

export default defineConfig({
  build: {
    lib: {
      // 라이브러리 엔트리 포인트 (src/index.ts)
      entry: resolve(__dirname, 'src/index.ts'),
      // 라이브러리의 전역 변수 이름 (UMD 번들 등에서 사용)
      name: 'TryChain',
      // 각 포맷별 파일 이름 지정
      fileName: format => `try-chain.${format}.js`,
      // 생성할 번들 포맷: ES Module, CommonJS, UMD
      formats: ['es', 'cjs', 'umd'],
    },
    rollupOptions: {
      // 외부 의존성이 있다면 여기에 추가 (예: peerDependencies)
      external: [],
      output: {
        // UMD 번들 사용 시 외부 라이브러리의 전역 변수 이름 지정
        globals: {},
      },
    },
  },
  plugins: [
    // 타입 선언 파일(.d.ts) 자동 생성
    dts({
      insertTypesEntry: true,
    }),
  ],
})
