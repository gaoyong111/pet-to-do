import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

/**
 * electron-vite 构建配置
 * 配置 main、preload、renderer 三个进程的构建选项
 */
export default defineConfig({
    main: {
        plugins: [externalizeDepsPlugin()],
        build: {
            outDir: 'out/main',
            rollupOptions: {
                input: {
                    index: 'src/main/index.ts'
                }
            }
        }
    },
    preload: {
        plugins: [externalizeDepsPlugin()],
        build: {
            outDir: 'out/preload',
            rollupOptions: {
                input: {
                    index: 'src/preload/index.ts'
                }
            }
        }
    },
    renderer: {
        root: 'src/renderer',
        build: {
            outDir: 'out/renderer'
        },
        plugins: [react()],
        resolve: {
            alias: {
                '@renderer': 'src/renderer/src'
            }
        }
    }
});
