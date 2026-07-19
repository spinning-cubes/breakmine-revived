export default class Tool {
    constructor(material) {
        this.material = material
        this.durability = Tool.materials.indexOf(material) * 64
        this.url = ''
    }

    static materials = [null, 'wood', 'stone', 'iron', 'diamond']
}