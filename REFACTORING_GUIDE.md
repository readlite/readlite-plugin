# ReadLite 代码重构指南

## 概述

本次重构旨在简化代码结构，提高可维护性和可读性。主要改进包括：

1. **模块化服务** - 将复杂逻辑拆分到独立的服务模块
2. **统一类型定义** - 减少类型重复，集中管理
3. **简化Context** - 合并多个Context为统一的AppContext
4. **组件拆分** - 将大型组件拆分为更小的可复用组件

## 主要变更

### 1. 新增服务模块

#### IframeManager (`/src/services/iframeManager.ts`)
- 管理iframe的创建、显示、隐藏和销毁
- 处理主题同步
- 简化了原本在content.tsx中的iframe逻辑

使用示例：
```typescript
import { iframeManager } from './services/iframeManager';

// 创建iframe
iframeManager.create('light');

// 显示/隐藏
iframeManager.show();
iframeManager.hide();

// 更新主题
iframeManager.updateTheme('dark');
```

#### ReaderStateManager (`/src/services/readerStateManager.ts`)
- 集中管理阅读器状态
- 提供状态订阅机制
- 自动同步到Chrome storage

使用示例：
```typescript
import { readerState } from './services/readerStateManager';

// 获取状态
const state = readerState.getState();

// 更新状态
readerState.toggleReaderMode();
readerState.updateSettings({ fontSize: 20 });

// 订阅状态变化
const unsubscribe = readerState.subscribe((newState) => {
  console.log('State changed:', newState);
});
```

#### LLMService (`/src/services/llmService.ts`)
- 统一的LLM API服务
- 简化了流式响应处理
- 合并了AIClient和llmClient的功能

使用示例：
```typescript
import { llmService } from './services/llmService';

// 生成流式响应
await llmService.generateStream(
  prompt,
  (chunk) => console.log(chunk),
  { model: 'gpt-4', temperature: 0.7 }
);

// 从对话消息生成响应
await llmService.generateFromMessages(
  messages,
  onChunk,
  settings
);
```

### 2. 统一的类型定义

所有常用类型现在都集中在 `/src/types/index.ts`：

```typescript
import { 
  Article, 
  Settings, 
  ExtensionMessage,
  AIMessage 
} from './types';
```

### 3. 简化的Context结构

新的AppContext (`/src/context/AppContext.tsx`) 整合了所有Context：

```typescript
import { useApp, useReaderState, useUIActions } from './context/AppContext';

// 在组件中使用
const Component = () => {
  const { state, actions } = useApp();
  const readerState = useReaderState();
  const uiActions = useUIActions();
  
  // 使用状态和操作
  uiActions.toggleSettings();
  console.log(readerState.article);
};
```

### 4. 组件重构

#### 简化的content.tsx
- 从758行减少到约200行
- 使用服务模块处理复杂逻辑
- 更清晰的职责分离

#### 模块化的Reader组件
- `Reader-new.tsx` - 主入口，处理文章加载
- `ReaderContainer.tsx` - UI容器，处理布局和交互
- `ReadingProgress.tsx` - 独立的进度条组件

## 迁移步骤

### 第1步：备份现有代码
```bash
git add .
git commit -m "Backup before refactoring"
```

### 第2步：替换文件

1. 将 `content-new.tsx` 重命名为 `content.tsx`
2. 将 `Reader-new.tsx` 重命名为 `Reader.tsx`
3. 将 `AIClient-new.ts` 重命名为 `AIClient.ts`

### 第3步：更新导入

在使用Reader的地方更新导入：
```typescript
// 旧的
import Reader from './components/core/Reader';

// 新的 - 如果使用AppProvider
import { AppProvider } from './context/AppContext';
import Reader from './components/core/Reader';

// 使用
<AppProvider>
  <Reader />
</AppProvider>
```

### 第4步：更新组件使用

替换直接的Context使用：
```typescript
// 旧的
const { article, settings } = useReader();

// 新的
const { state } = useApp();
const { article, settings } = state;
```

### 第5步：测试功能

1. 测试阅读模式的开启/关闭
2. 测试设置面板
3. 测试AI助手
4. 测试主题切换
5. 测试文章解析

## 性能改进

1. **减少重渲染** - 状态管理更精细，避免不必要的重渲染
2. **懒加载** - AI组件和设置面板按需加载
3. **内存优化** - 及时清理流式连接和事件监听器

## 代码质量改进

1. **更好的类型安全** - 统一的类型定义减少了类型错误
2. **更易测试** - 模块化的服务更容易单元测试
3. **更清晰的职责** - 每个模块有明确的单一职责
4. **更少的代码重复** - 共享的逻辑被提取到服务中

## 注意事项

1. 确保Chrome扩展的manifest.json正确配置
2. 检查所有Chrome API调用的权限
3. 测试不同网站的兼容性
4. 验证主题切换在iframe中正常工作

## 后续优化建议

1. **添加错误边界** - 在关键组件周围添加错误边界
2. **实现代码分割** - 对大型组件进行代码分割
3. **添加性能监控** - 使用React DevTools Profiler
4. **优化打包配置** - 调整webpack/plasmo配置以减小包体积
5. **添加单元测试** - 为关键服务和组件添加测试

## 总结

本次重构主要关注：
- ✅ 代码结构更合理
- ✅ 代码更可读
- ✅ 整体更简单
- ✅ 功能保持不变

通过模块化和服务化，代码现在更容易理解、维护和扩展。