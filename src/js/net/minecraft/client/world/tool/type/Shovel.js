import Tool from '../Tool.js'

export default class Shovel extends Tool {
    constructor(material) {
        super(material);

        this.efficiency = 2 * 2
        this.url = `objects/shovel/${material}.json`
    }
}