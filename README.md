# Fairy Controller Editor

一个基于 Cocos Creator 2.4.15 的 UI 控制器示例项目。

项目提供了一套接近 FairyGUI 使用习惯的控制器编辑能力，包括：

- 在编辑器顶部 Scene toolbar 中展示当前场景或预制体里的控制器
- 在节点属性检查器底部插入“属性控制”区域
- 将控制器数据序列化到根节点上的 `UIController` 组件
- 运行时通过 `UIController.setIndex(controllerName, index)` 驱动 UI 切换

## 已实现能力

### 1. 控制器编辑

- 创建、编辑、删除控制器
- 为控制器配置页面列表
- 控制器信息在场景或预制体中持久化
- 切换 scene / prefab 时自动刷新 toolbar
- 点击 toolbar 上的控制器名称可打开编辑面板
- toolbar 上每个控制器都可以单独切换自己的索引

### 2. 节点属性控制

选中节点后，属性检查器底部会显示“属性控制”区域。

当前已支持：

- `显示-2`
  - 支持两个控制条件
  - 支持 `与 / 或`
- `位置(X/Y)`
- `大小(宽/高/ScaleX/ScaleY)`
- `颜色`
- `文本`
- `字体大小`

说明：

- `文本` 和 `字体大小` 仅在节点包含 `Label` 或 `RichText` 组件时可创建
- 文本、颜色、大小、字号控制都跟随顶部 toolbar 当前选中的控制器索引
- 删除某个属性控制器后，不会影响其他控制器数据

## 运行时组件

### `UIController`

核心运行时组件，负责：

- 存储控制器列表 `controllersJson`
- 存储显示绑定 `bindingsJson`
- 根据当前控制器索引刷新各类 gear

当前会驱动这些 gear：

- `UIControllerGearDisplay`
- `UIControllerGearText`
- `UIControllerGearColor`
- `UIControllerGearPosition`
- `UIControllerGearSize`
- `UIControllerGearFontSize`

### 主要运行时 API

```ts
controller.setIndex(controllerName, index);
controller.setPreview(controllerName, pageName);
controller.clearRuntimePreview();

controller.getIndex(controllerName);
controller.getActiveControllerName();
controller.getActivePageName();
controller.getCurrentPageName(controllerName);
controller.getCurrentPageId(controllerName);
```

## 示例

[`assets/Script/HelloWorld.ts`](/Users/cc/NewProject_1/assets/Script/HelloWorld.ts) 中演示了最基本的控制器切换：

```ts
this.node.getComponent(UIController).setIndex("controller", 0);
this.node.getComponent(UIController).setIndex("controller", 1);
```

## 目录说明

- [`assets/Script/UIController.ts`](/Users/cc/NewProject_1/assets/Script/UIController.ts)
  - 控制器运行时核心逻辑
- [`assets/Script/UIControllerGearDisplay.js`](/Users/cc/NewProject_1/assets/Script/UIControllerGearDisplay.js)
  - 显示控制
- [`assets/Script/UIControllerGearText.js`](/Users/cc/NewProject_1/assets/Script/UIControllerGearText.js)
  - 文本控制
- [`assets/Script/UIControllerGearColor.js`](/Users/cc/NewProject_1/assets/Script/UIControllerGearColor.js)
  - 颜色控制
- [`assets/Script/UIControllerGearPosition.js`](/Users/cc/NewProject_1/assets/Script/UIControllerGearPosition.js)
  - 位置控制
- [`assets/Script/UIControllerGearSize.js`](/Users/cc/NewProject_1/assets/Script/UIControllerGearSize.js)
  - 大小控制
- [`assets/Script/UIControllerGearFontSize.js`](/Users/cc/NewProject_1/assets/Script/UIControllerGearFontSize.js)
  - 字体大小控制
- [`packages/fairy-controller-editor/main.js`](/Users/cc/NewProject_1/packages/fairy-controller-editor/main.js)
  - 编辑器注入、toolbar、属性控制区域、数据落盘
- [`packages/fairy-controller-editor/panel/index.js`](/Users/cc/NewProject_1/packages/fairy-controller-editor/panel/index.js)
  - 控制器创建/编辑面板
- [`packages/fairy-controller-editor/inspectors/ui-controller.js`](/Users/cc/NewProject_1/packages/fairy-controller-editor/inspectors/ui-controller.js)
  - `UIController` 自定义 Inspector

## 当前限制

- “外观(透明度/旋转/变灰/不可触摸)”和“图标”菜单项还未实现
- 当前 ReadMe 描述的是项目内已完成的功能，不包含未来规划

