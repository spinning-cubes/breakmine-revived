import Pickaxe from './type/Pickaxe.js'
import Sword from './type/Sword.js'
import Shovel from './type/Shovel.js'
import Axe from './type/Axe.js'
import Hoe from './type/Hoe.js'

export class ToolRegistry {
    /**
     * @type {Record<string, Tool>}
     */
    static tools = {}

    /**
     * Maps an item type id (what ItemStack.typeId stores) to a tool instance.
     * The rest of the codebase currently assumes `typeId` is a block id; for tools
     * we need a separate lookup so the renderer can pick the right geometry.
     */
    static toolByTypeId = new Map()

    static register(typeId, tool) {
        ToolRegistry.toolByTypeId.set(typeId, tool)
    }

    static getToolByTypeId(typeId) {
        return ToolRegistry.toolByTypeId.get(typeId) || null
    }

    static create() {
        // Clear previous state (important on hot reload)
        ToolRegistry.tools = {}
        ToolRegistry.toolByTypeId = new Map()

        // Default set (iron)
        // NOTE: ids here must match whatever ItemStack.typeId you use when adding to inventory.
        // ContainerSurvival will be updated to use these ids.
        ToolRegistry.tools.IRON_PICKAXE = new Pickaxe('iron')
        ToolRegistry.tools.IRON_SWORD = new Sword('iron')
        ToolRegistry.tools.IRON_SHOVEL = new Shovel('iron')
        ToolRegistry.tools.IRON_AXE = new Axe('iron')
        ToolRegistry.tools.IRON_HOE = new Hoe('iron')

        ToolRegistry.register('iron_pickaxe', ToolRegistry.tools.IRON_PICKAXE)
        ToolRegistry.register('iron_sword', ToolRegistry.tools.IRON_SWORD)
        ToolRegistry.register('iron_shovel', ToolRegistry.tools.IRON_SHOVEL)
        ToolRegistry.register('iron_axe', ToolRegistry.tools.IRON_AXE)
        ToolRegistry.register('iron_hoe', ToolRegistry.tools.IRON_HOE)
    }
}

