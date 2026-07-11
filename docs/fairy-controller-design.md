# Fairy Controller Design

## FairyGUI Controller 要点

- `Controller` 本身不直接渲染 UI，它只保存一个离散状态：当前页。
- 一个控制器同时维护 `pageName` 和 `pageId`，运行时切换主要依赖 `selectedIndex / selectedPage / selectedPageId`。
- UI 的真正变化通常不写在控制器里，而是分散在各个 `Gear` 上。
- 常见 `Gear` 有 `GearDisplay`、`GearText`、`GearXY`、`GearSize`、`GearLook`、`GearColor`、`GearIcon`、`GearAnimation`。
- Controller 还支持 `Action`，常见是：
  - 切页时播放 Transition
  - 切页时驱动另一个 Controller 跳页

## 当前 Cocos 实现映射

- `UIController`
  - 对应 FairyGUI `Controller`
  - 支持 `pages`、`selectedIndex`、`pageName/pageId`
  - 支持基础 `actions`
- `UIControllerGearDisplay`
  - 对应 FairyGUI `GearDisplay`
  - 控制节点显隐
- `UIControllerGearText`
  - 对应 FairyGUI `GearText`
  - 控制 `cc.Label.string`
- `UIControllerGearPosition`
  - 对应 FairyGUI `GearXY`
  - 控制节点位置

## 和 FairyGUI 仍有差距的部分

- 还没有 `Transition` 系统，所以 `PlayTransitionAction` 目前未实现
- 还没有 `GearLook / GearSize / GearColor / GearIcon / GearAnimation`
- Inspector 里还没有真正的 page 下拉选择，当前是手填 `pageName` 或 `pageId`

## 下一步建议

- 优先补 `GearLook`
  - 可覆盖透明度、旋转、置灰、可点击
- 再补 `GearSize`
  - 可覆盖宽高和缩放
- 最后做自定义 Inspector
  - 把手填字符串改成从 Controller 页面列表里选择
