const { ccclass, property } = cc._decorator;

type UIControllerPage = {
    id: string;
    name: string;
    remark?: string;
};

type UIControllerItem = {
    name: string;
    remark?: string;
    pages: UIControllerPage[];
    selectedIndex?: number;
};

type UIDisplayCondition = {
    controllerName: string;
    visiblePages: number[];
};

type UIDisplayBindingValue = {
    visiblePages?: number[];
    conditions?: UIDisplayCondition[];
    mode?: 'and' | 'or';
};

type UIControllerBinding = {
    id: string;
    nodePath: string;
    nodeUuid?: string;
    controllerName: string;
    type: 'display';
    values: UIDisplayBindingValue;
};

type RuntimePreview = {
    controller: string;
    page: string;
} | null;

function safeJsonParse<T>(text: string, fallback: T[]): T[] {
    if (!text) {
        return fallback;
    }

    try {
        const parsed = JSON.parse(text);
        return Array.isArray(parsed) ? parsed : fallback;
    }
    catch (error) {
        cc.warn('[UIController] invalid controllersJson:');
        return fallback;
    }
}

function getPageToken(page: UIControllerPage | null | undefined, index: number): string {
    if (!page) {
        return '';
    }

    if (page.id) {
        return page.id;
    }

    if (page.name) {
        return page.name;
    }

    return String(index);
}

function normalizeControllers(items: UIControllerItem[]): UIControllerItem[] {
    const source = Array.isArray(items) ? items : [];
    const result: UIControllerItem[] = [];
    for (let i = 0; i < source.length; i++) {
        const item = source[i] || {} as UIControllerItem;
        const pagesSource = Array.isArray(item.pages) ? item.pages : [];
        const pages: UIControllerPage[] = [];
        for (let j = 0; j < pagesSource.length; j++) {
            const page = pagesSource[j] || {} as UIControllerPage;
            pages.push({
                id: page.id || ('page-' + j),
                name: page.name || '',
                remark: page.remark || '',
            });
        }

        const maxIndex = pages.length ? pages.length - 1 : 0;
        let selectedIndex = typeof item.selectedIndex === 'number' ? item.selectedIndex : 0;
        if (selectedIndex < 0) {
            selectedIndex = 0;
        }
        if (selectedIndex > maxIndex) {
            selectedIndex = maxIndex;
        }

        result.push({
            name: item.name || '',
            remark: item.remark || '',
            pages: pages,
            selectedIndex: pages.length ? selectedIndex : 0,
        });
    }
    return result;
}

function normalizeBindings(items: UIControllerBinding[]): UIControllerBinding[] {
    const source = Array.isArray(items) ? items : [];
    const result: UIControllerBinding[] = [];
    for (let i = 0; i < source.length; i++) {
        const item = source[i] || {} as UIControllerBinding;
        const rawConditions = item.values && Array.isArray(item.values.conditions)
            ? item.values.conditions
            : [];
        const normalizedConditions: UIDisplayCondition[] = [];
        for (let j = 0; j < rawConditions.length; j++) {
            const condition = rawConditions[j] || {} as UIDisplayCondition;
            const controllerName = condition.controllerName || '';
            if (!controllerName) {
                continue;
            }
            const visiblePages = Array.isArray(condition.visiblePages)
                ? condition.visiblePages.filter((page) => typeof page === 'number')
                : [];
            normalizedConditions.push({
                controllerName: controllerName,
                visiblePages: visiblePages,
            });
        }

        if (!normalizedConditions.length && item.controllerName) {
            const visiblePages = item.values && Array.isArray(item.values.visiblePages)
                ? item.values.visiblePages.filter((page) => typeof page === 'number')
                : [];
            normalizedConditions.push({
                controllerName: item.controllerName || '',
                visiblePages: visiblePages,
            });
        }

        if (!normalizedConditions.length) {
            continue;
        }

        const mode = item.values && item.values.mode === 'and' ? 'and' : 'or';
        result.push({
            id: item.id || ('binding-' + i),
            nodePath: item.nodePath || '',
            nodeUuid: item.nodeUuid || '',
            controllerName: normalizedConditions[0].controllerName || '',
            type: 'display',
            values: {
                visiblePages: normalizedConditions[0].visiblePages.slice(),
                conditions: normalizedConditions,
                mode: mode,
            },
        });
    }
    return result;
}

@ccclass
export default class UIController extends cc.Component {
    @property({
        multiline: true,
        visible: false,
    })
    controllersJson = '[]';

    @property({
        multiline: true,
        visible: false,
    })
    bindingsJson = '[]';

    @property({
        visible: false,
    })
    previewController = '';

    @property({
        visible: false,
    })
    previewPage = '';

    @property({
        tooltip: '开启后，编辑器里切换控制器或页面会立即预览',
    })
    previewInEditor = true;

    private _controllersCache: UIControllerItem[] | null = null;
    private _bindingsCache: UIControllerBinding[] | null = null;
    private _runtimePreview: RuntimePreview = null;
    private _runtimeIndexMap: { [controllerName: string]: number } = {};
    private _lastControllersJson = '';
    private _lastBindingsJson = '';
    private _lastPreviewController = '';
    private _lastPreviewPage = '';


    onLoad() {
        this._controllersCache = null;
        this._bindingsCache = null;
        this._runtimePreview = null;
        this._runtimeIndexMap = {};
        this._lastControllersJson = this.controllersJson;
        this._lastBindingsJson = this.bindingsJson;
        this._lastPreviewController = this.previewController;
        this._lastPreviewPage = this.previewPage;
        this._ensurePreviewSelection();
        this.applyAll();
    }

    onEnable() {
        this.applyAll();
    }

    update() {
        if (
            this.controllersJson === this._lastControllersJson
            && this.bindingsJson === this._lastBindingsJson
            && this.previewController === this._lastPreviewController
            && this.previewPage === this._lastPreviewPage
        ) {
            return;
        }

        const controllersChanged = this.controllersJson !== this._lastControllersJson;
        const bindingsChanged = this.bindingsJson !== this._lastBindingsJson;
        this._lastControllersJson = this.controllersJson;
        this._lastBindingsJson = this.bindingsJson;
        this._lastPreviewController = this.previewController;
        this._lastPreviewPage = this.previewPage;

        if (controllersChanged) {
            this._controllersCache = null;
        }
        if (bindingsChanged) {
            this._bindingsCache = null;
        }

        this._ensurePreviewSelection();
        this.applyAll();
    }

    getControllers(): UIControllerItem[] {
        if (!this._controllersCache) {
            this._controllersCache = normalizeControllers(safeJsonParse<UIControllerItem>(this.controllersJson, []));
        }
        return this._controllersCache;
    }

    getBindings(): UIControllerBinding[] {
        if (!this._bindingsCache) {
            this._bindingsCache = normalizeBindings(safeJsonParse<UIControllerBinding>(this.bindingsJson, []));
        }
        return this._bindingsCache;
    }

    getController(controllerName: string): UIControllerItem | null {
        const controllers = this.getControllers();
        for (let i = 0; i < controllers.length; i++) {
            if (controllers[i].name === controllerName) {
                return controllers[i];
            }
        }
        return null;
    }

    getControllerNames(): string[] {
        const controllers = this.getControllers();
        const names: string[] = [];
        for (let i = 0; i < controllers.length; i++) {
            names.push(controllers[i].name || '');
        }
        return names;
    }

    getPageNames(controllerName: string): string[] {
        const controller = this.getController(controllerName);
        if (!controller || !controller.pages) {
            return [];
        }

        const names: string[] = [];
        for (let i = 0; i < controller.pages.length; i++) {
            names.push(controller.pages[i].name || getPageToken(controller.pages[i], i));
        }
        return names;
    }

    getPageIds(controllerName: string): string[] {
        const controller = this.getController(controllerName);
        if (!controller || !controller.pages) {
            return [];
        }

        const ids: string[] = [];
        for (let i = 0; i < controller.pages.length; i++) {
            ids.push(getPageToken(controller.pages[i], i));
        }
        return ids;
    }

    getActiveControllerName(): string {
        if (this._runtimePreview && this._runtimePreview.controller) {
            return this._runtimePreview.controller;
        }
        return this.previewController;
    }

    getActivePageName(): string {
        if (this._runtimePreview && this._runtimePreview.page) {
            return this._runtimePreview.page;
        }
        return this.previewPage;
    }

    getActivePageId(): string {
        return this.getPageId(this.getActiveControllerName(), this.getActivePageName());
    }

    getIndex(controllerName: string): number {
        const controller = this.getController(controllerName);
        if (!controller) {
            return -1;
        }
        return this._getResolvedIndex(controller);
    }

    getPageId(controllerName: string, pageName: string): string {
        const controller = this.getController(controllerName);
        if (!controller || !controller.pages) {
            return '';
        }

        for (let i = 0; i < controller.pages.length; i++) {
            const page = controller.pages[i];
            const token = getPageToken(page, i);
            if (page.name === pageName || token === pageName) {
                return token;
            }
        }

        return '';
    }

    getPageNameByIndex(controllerName: string, index: number): string {
        const controller = this.getController(controllerName);
        if (!controller || !controller.pages || index < 0 || index >= controller.pages.length) {
            return '';
        }

        return getPageToken(controller.pages[index], index);
    }

    getCurrentPageName(controllerName: string): string {
        const controller = this.getController(controllerName);
        if (!controller) {
            return '';
        }

        const index = this._getResolvedIndex(controller);
        return this.getPageNameByIndex(controllerName, index);
    }

    getCurrentPageId(controllerName: string): string {
        const pageName = this.getCurrentPageName(controllerName);
        if (!pageName) {
            return '';
        }
        return this.getPageId(controllerName, pageName);
    }

    setPreview(controllerName: string, pageName: string) {
        this._runtimePreview = {
            controller: controllerName || '',
            page: pageName || '',
        };
        this.applyAll();
        this.node.emit('controller-preview-changed', this.getActiveControllerName(), this.getActivePageName());
    }

    clearRuntimePreview() {
        this._runtimePreview = null;
        this.applyAll();
    }

    setIndex(controllerName: string, index: number): boolean {
        const controller = this.getController(controllerName);
        if (!controller || !controller.pages || !controller.pages.length) {
            return false;
        }
        if (index < 0 || index >= controller.pages.length) {
            return false;
        }
        controller.selectedIndex = index;
        this._runtimeIndexMap[controllerName] = index;
        this._runtimePreview = {
            controller: controllerName,
            page: getPageToken(controller.pages[index], index),
        };
        this.applyController(controllerName);
        this.node.emit('controller-preview-changed', this.getActiveControllerName(), this.getActivePageName());
        this.node.emit('ui-controller-changed', {
            controllerName: controllerName,
            index: index,
        });
        return true;
    }

    applyPreview() {
        this.applyAll();
    }

    applyController(controllerName: string) {
        if (CC_EDITOR && !this.previewInEditor) {
            return;
        }

        this._ensurePreviewSelection();
        this._applyGears('UIControllerGearDisplay');
        this._applyDisplayBindings();
        this._applyGears('UIControllerGearText');
        this._applyGears('UIControllerGearColor');
        this._applyGears('UIControllerGearPosition');
        this._applyGears('UIControllerGearSize');
        this._applyGears('UIControllerGearFontSize');
        this._applyGears('UIControllerGearImage');
    }

    applyAll() {
        if (CC_EDITOR && !this.previewInEditor) {
            return;
        }

        this._ensurePreviewSelection();

        this._applyGears('UIControllerGearDisplay');
        this._applyDisplayBindings();

        this._applyGears('UIControllerGearText');
        this._applyGears('UIControllerGearColor');
        this._applyGears('UIControllerGearPosition');
        this._applyGears('UIControllerGearSize');
        this._applyGears('UIControllerGearFontSize');
        this._applyGears('UIControllerGearImage');
    }

    updateControllers(controllers: UIControllerItem[], keepPreview?: boolean) {
        this.controllersJson = JSON.stringify(normalizeControllers(controllers || []), null, 2);
        this._controllersCache = null;

        if (!keepPreview) {
            this.previewController = '';
            this.previewPage = '';
        }

        this._ensurePreviewSelection();
        this.applyAll();
    }

    updateBindings(bindings: UIControllerBinding[]) {
        this.bindingsJson = JSON.stringify(normalizeBindings(bindings || []), null, 2);
        this._bindingsCache = null;
        this.applyAll();
    }

    private _applyGears(componentName: string) {
        const gears = this.node.getComponentsInChildren(componentName) as Array<{ enabled: boolean; apply?: () => void }>;
        for (let i = 0; i < gears.length; i++) {
            if (gears[i] && gears[i].enabled && gears[i].apply) {
                gears[i].apply!();
            }
        }
    }

    private _applyDisplayBindings() {
        const bindings = this.getBindings();
        if (!bindings.length) {
            return;
        }

        for (let i = 0; i < bindings.length; i++) {
            const binding = bindings[i];
            if (!binding || binding.type !== 'display') {
                continue;
            }

            const targetNode = this._resolveBindingNode(binding);
            if (!targetNode) {
                continue;
            }

            targetNode.active = this._matchesDisplayBinding(binding);
        }
    }

    private _matchesDisplayBinding(binding: UIControllerBinding): boolean {
        const conditions = binding.values && Array.isArray(binding.values.conditions) && binding.values.conditions.length
            ? binding.values.conditions
            : [{
                controllerName: binding.controllerName || '',
                visiblePages: binding.values && Array.isArray(binding.values.visiblePages)
                    ? binding.values.visiblePages
                    : [],
            }];

        if (!conditions.length) {
            return false;
        }

        const mode = binding.values && binding.values.mode === 'and' ? 'and' : 'or';
        let matchedCount = 0;
        for (let i = 0; i < conditions.length; i++) {
            if (this._matchesDisplayCondition(conditions[i])) {
                matchedCount += 1;
                if (mode === 'or') {
                    return true;
                }
            }
            else if (mode === 'and') {
                return false;
            }
        }

        return mode === 'and' ? matchedCount === conditions.length : false;
    }

    private _matchesDisplayCondition(condition: UIDisplayCondition): boolean {
        if (!condition || !condition.controllerName) {
            return false;
        }

        const controller = this.getController(condition.controllerName);
        if (!controller) {
            return false;
        }

        const selectedIndex = this._getResolvedIndex(controller);
        const visiblePages = Array.isArray(condition.visiblePages) ? condition.visiblePages : [];
        return visiblePages.indexOf(selectedIndex) !== -1;
    }

    private _getResolvedIndex(controller: UIControllerItem): number {
        if (!controller || !controller.name) {
            return -1;
        }

        if (this._runtimePreview && this._runtimePreview.controller === controller.name) {
            const previewIndex = this._getPageIndex(controller, this._runtimePreview.page);
            if (previewIndex >= 0) {
                return previewIndex;
            }
        }

        if (CC_EDITOR && this.previewController === controller.name) {
            const editorPreviewIndex = this._getPageIndex(controller, this.previewPage);
            if (editorPreviewIndex >= 0) {
                return editorPreviewIndex;
            }
        }

        if (typeof this._runtimeIndexMap[controller.name] === 'number') {
            return this._runtimeIndexMap[controller.name];
        }

        const selectedIndex = typeof controller.selectedIndex === 'number' ? controller.selectedIndex : 0;
        if (!controller.pages || !controller.pages.length) {
            return selectedIndex;
        }
        if (selectedIndex < 0) {
            return 0;
        }
        if (selectedIndex >= controller.pages.length) {
            return controller.pages.length - 1;
        }
        return selectedIndex;
    }

    private _getPageIndex(controller: UIControllerItem | null, pageRef: string): number {
        if (!controller || !controller.pages || !controller.pages.length || !pageRef) {
            return -1;
        }

        for (let i = 0; i < controller.pages.length; i++) {
            const page = controller.pages[i];
            const token = getPageToken(page, i);
            if (page.name === pageRef || token === pageRef) {
                return i;
            }
        }

        return -1;
    }

    private _resolveBindingNode(binding: UIControllerBinding): cc.Node | null {
        if (!binding) {
            return null;
        }

        if (binding.nodePath) {
            const path = binding.nodePath.split('/').filter(Boolean);
            let current: cc.Node | null = this.node;
            for (let i = 0; i < path.length; i++) {
                if (!current) {
                    break;
                }
                current = current.getChildByName(path[i]);
            }
            if (current) {
                return current;
            }
        }

        if (binding.nodeUuid) {
            return this._findNodeByUuid(binding.nodeUuid);
        }

        return null;
    }

    private _findNodeByUuid(uuid: string): cc.Node | null {
        if (!uuid) {
            return null;
        }

        const stack: cc.Node[] = [this.node];
        while (stack.length) {
            const current = stack.shift() || null;
            if (!current) {
                continue;
            }
            if (current.uuid === uuid) {
                return current;
            }
            const children = current.children || [];
            for (let i = 0; i < children.length; i++) {
                stack.push(children[i]);
            }
        }
        return null;
    }

    private _ensurePreviewSelection() {
        const controllers = this.getControllers();
        if (!controllers.length) {
            this.previewController = '';
            this.previewPage = '';
            return;
        }

        let controller = this.getController(this.previewController);
        if (!controller) {
            controller = controllers[0];
            this.previewController = controller.name || '';
        }

        if (!controller.pages || !controller.pages.length) {
            this.previewPage = '';
            return;
        }

        let found = false;
        for (let i = 0; i < controller.pages.length; i++) {
            const page = controller.pages[i];
            const token = getPageToken(page, i);
            if (page.name === this.previewPage || token === this.previewPage) {
                found = true;
                this.previewPage = token;
                break;
            }
        }

        if (!found) {
            this.previewPage = getPageToken(controller.pages[0], 0);
        }
    }
}

(UIController as any).editor = CC_EDITOR && {
    executeInEditMode: true,
    menu: 'Custom/Fairy Controller',
    inspector: 'packages://fairy-controller-editor/inspectors/ui-controller.js',
};
