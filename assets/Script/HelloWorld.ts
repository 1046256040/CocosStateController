import UIController from './UIController';

const { ccclass, property } = cc._decorator;

@ccclass
export default class HelloWorld extends cc.Component {
    @property
    text = 'Hello, World!';

    private controller: UIController = null;

    onLoad() {
        this.controller = this.getComponent(UIController) || this.addComponent(UIController);
        this._setupDemoTargetsIfNeeded();
        this.node.on(cc.Node.EventType.TOUCH_END, this._switchPage, this);
    }

    protected onEnable(): void {
        this.node.getChildByName('btn1').on('click', this.onBtn1Click, this);
        this.node.getChildByName('btn2').on('click', this.onBtn2Click, this);
    }

    onBtn1Click() {
        this.node.getComponent(UIController).setIndex("controller", 0);
    }

    onBtn2Click() {
        this.node.getComponent(UIController).setIndex("controller", 1);
    }

    onDestroy() {
        if (this.controller) {
            this.controller.node.off('controller-preview-changed', this._refreshLabel, this);
        }
        this.node.off(cc.Node.EventType.TOUCH_END, this._switchPage, this);
    }

    private _switchPage() {
        const controllerName = this.controller.getActiveControllerName();
        const pages = this.controller.getPageNames(controllerName);
        if (!pages.length) {
            return;
        }

        const current = this.controller.getActivePageName();
        const index = pages.indexOf(current);
        const next = pages[(index + 1) % pages.length];
        this.controller.setPreview(controllerName, next);
    }

    private _setupDemoTargetsIfNeeded() {
        this.controller.applyPreview();
    }
}
