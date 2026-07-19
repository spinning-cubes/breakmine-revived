import Tool from '../Tool.js'

export default class Sword extends Tool {
    constructor(material) {
        super(material);

        this.efficiency = 2 * 2
        this.url = `objects/sword/${material}.json`
    }
}