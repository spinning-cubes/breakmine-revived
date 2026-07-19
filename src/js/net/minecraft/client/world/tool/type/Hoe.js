import Tool from '../Tool.js'

export default class Hoe extends Tool {
    constructor(material) {
        super(material);

        this.efficiency = 2 * 2
        this.url = `objects/hoe/${material}.json`
    }
}