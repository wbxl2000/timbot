# 响应式 SCSS Mixin 文档

## 📋 速查列表

### 基础断点
- `@include mobile` - 移动端样式（默认）
- `@include tablet` - 平板及以上 (≥768px)
- `@include desktop` - 桌面端及以上 (≥1024px)
- `@include large-desktop` - 大桌面端及以上 (≥1440px)

### 范围断点
- `@include mobile-only` - 仅移动端 (<768px)
- `@include tablet-only` - 仅平板 (768px-1023px)
- `@include desktop-only` - 仅桌面端 (1024px-1439px)

### 便捷断点
- `@include tablet-and-up` - 平板及以上 (≥768px)
- `@include desktop-and-up` - 桌面端及以上 (≥1024px)
- `@include large-desktop-and-up` - 大桌面端及以上 (≥1440px)

### 实用工具
- `@include container($max-width, $padding)` - 响应式容器
- `@include grid($columns, $gap)` - 响应式网格
- `@include hide-on($breakpoint)` - 隐藏元素
- `@include show-on($breakpoint)` - 显示元素
- `@include responsive-text($mobile, $tablet, $desktop)` - 响应式文本
- `@include responsive-spacing($property, $mobile, $tablet, $desktop)` - 响应式间距

---

## 📱 基础断点

### `@include mobile`
移动端样式（默认样式，移动端优先）

```scss
.button {
  width: 100%;
  height: 44px;
  
  @include tablet {
    width: auto;
    height: 40px;
  }
}
```

### `@include tablet`
平板及以上设备 (≥768px)

```scss
.card {
  padding: 16px;
  
  @include tablet {
    padding: 24px;
  }
}
```

### `@include desktop`
桌面端及以上设备 (≥1024px)

```scss
.layout {
  flex-direction: column;
  
  @include desktop {
    flex-direction: row;
  }
}
```

### `@include large-desktop`
大桌面端及以上设备 (≥1440px)

```scss
.container {
  max-width: 1200px;
  
  @include large-desktop {
    max-width: 1400px;
  }
}
```

---

## 🎯 范围断点

### `@include mobile-only`
仅移动端设备 (<768px)

```scss
.mobile-menu {
  @include mobile-only {
    display: block;
  }
}
```

### `@include tablet-only`
仅平板设备 (768px-1023px)

```scss
.tablet-content {
  @include tablet-only {
    display: block;
  }
}
```

### `@include desktop-only`
仅桌面端设备 (1024px-1439px)

```scss
.desktop-feature {
  @include desktop-only {
    display: block;
  }
}
```

---

## ⚡ 便捷断点

### `@include tablet-and-up`
平板及以上设备 (≥768px) - 与 `@include tablet` 相同

```scss
.sidebar {
  @include tablet-and-up {
    width: 250px;
  }
}
```

### `@include desktop-and-up`
桌面端及以上设备 (≥1024px) - 与 `@include desktop` 相同

```scss
.navigation {
  @include desktop-and-up {
    position: static;
  }
}
```

---

## 🛠️ 实用工具

### `@include container($max-width, $padding)`
创建响应式容器

```scss
.page-wrapper {
  @include container(1200px, 16px);
}
```

**编译结果:**
```css
.page-wrapper {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 16px;
}

@media (min-width: 768px) {
  .page-wrapper {
    padding: 0 24px;
  }
}

@media (min-width: 1024px) {
  .page-wrapper {
    padding: 0 32px;
  }
}
```

### `@include grid($columns, $gap)`
创建响应式网格

```scss
.grid {
  @include grid(12, 16px);
  
  .item {
    grid-column: 1 / -1; // 移动端占满
    
    @include tablet {
      grid-column: span 6; // 平板占6列
    }
    
    @include desktop {
      grid-column: span 4; // 桌面占4列
    }
  }
}
```

### `@include hide-on($breakpoint)`
在指定断点隐藏元素

```scss
.mobile-only {
  @include hide-on(tablet);
}
```

### `@include show-on($breakpoint)`
在指定断点显示元素

```scss
.desktop-only {
  @include show-on(desktop);
}
```

### `@include responsive-text($mobile, $tablet, $desktop)`
响应式文本大小

```scss
.heading {
  @include responsive-text(24px, 32px, 48px);
}
```

**编译结果:**
```css
.heading {
  font-size: 24px;
}

@media (min-width: 768px) {
  .heading {
    font-size: 32px;
  }
}

@media (min-width: 1024px) {
  .heading {
    font-size: 48px;
  }
}
```

### `@include responsive-spacing($property, $mobile, $tablet, $desktop)`
响应式间距

```scss
.section {
  @include responsive-spacing(margin, 16px, 24px, 32px);
  @include responsive-spacing(padding, 12px, 20px, 28px);
  @include responsive-spacing(gap, 12px, 20px, 28px);
}
```

---

## 📐 断点参考

| 断点 | 宽度 | 用途 |
|------|------|------|
| mobile | 0px | 移动端（默认） |
| tablet | 768px | 平板设备 |
| desktop | 1024px | 桌面设备 |
| large-desktop | 1440px | 大桌面设备 |

---

## 💡 最佳实践

1. **移动端优先**: 先写移动端样式，再写大屏幕样式
2. **语义化命名**: 使用有意义的类名和注释
3. **渐进增强**: 从基础功能开始，逐步增强
4. **性能考虑**: 避免过度使用媒体查询
5. **一致性**: 在整个项目中保持断点使用的一致性 
