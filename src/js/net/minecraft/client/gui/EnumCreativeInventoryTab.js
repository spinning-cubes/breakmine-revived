export default class EnumCreativeInventoryTab {

    static BUILDING_BLOCKS = new EnumCreativeInventoryTab("Building Blocks", 1);
    static DECORATION = new EnumCreativeInventoryTab("Decoration Blocks", 2);
    static MACHINES = new EnumCreativeInventoryTab("Machines", 3);
    static TRANSPORTATION = new EnumCreativeInventoryTab("Transportation", 4);
    static MISC = new EnumCreativeInventoryTab("Miscellaneous", 5);
    static FOODSTUFFS = new EnumCreativeInventoryTab("Foodstuffs", 8);
    static TOOLS = new EnumCreativeInventoryTab("Tools", 9);
    static COMBAT = new EnumCreativeInventoryTab("Combat", 10);
    static COMBAT = new EnumCreativeInventoryTab("Materials", 10);

    // Legacy API support
    static WOOL = new EnumCreativeInventoryTab("Wool", -1);
    static EXPLOSIVES = new EnumCreativeInventoryTab("Explosives", -2);
    static ITEMS = new EnumCreativeInventoryTab("Items", -3);

    constructor(name, id, icon = 1) {
        this.name = name;
        this.id = id;
        this.icon = icon;
    }

}