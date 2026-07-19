import Tool from '../Tool.js'

export default class Pickaxe extends Tool {
    constructor(material) {
        super(material);

        this.efficiency = 3 * 2
        this.url = `objects/pickaxe/${material}.json`
    }
}