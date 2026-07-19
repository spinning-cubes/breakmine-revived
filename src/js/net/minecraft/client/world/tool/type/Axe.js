import Tool from '../Tool.js'

export default class Axe extends Tool {
    constructor(material) {
        super(material);

        this.efficiency = 2 * 2
        this.url = `objects/axe/${material}.json`
    }
}