const { ccclass, property } = cc._decorator;

@ccclass
export default class UIControllerData extends cc.Component {
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
}

(UIControllerData as any).editor = CC_EDITOR && {
    executeInEditMode: true,
    menu: 'Custom/Fairy Controller Data',
    inspector: 'packages://fairy-controller-editor/inspectors/ui-controller.js'
};
