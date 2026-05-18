import { useState, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ShoppingBag,
  Star,
  Sparkles,
  Package,
  Trophy,
  ChevronRight,
  Zap,
  Shield,
  Crown,
  Flame,
  Snowflake,
  Sun,
  Moon,
  Gift,
  Check,
  Lock,
  Dumbbell,
  Clock,
  BedDouble,
  UtensilsCrossed,
  Gamepad2,
} from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import {
  useShopItems,
  useUserInventory,
  useGachaPity,
  useSpendablePoints,
  usePullGacha,
  useBuyFromShop,
  useEquipItem,
  useUseCoupon,
  useUserPoints,
} from "@/hooks/useData";

const RARITY_CONFIG = {
  common: { label: "普通", labelEn: "Common", color: "bg-gray-100 text-gray-700 border-gray-300", glow: "", icon: Shield },
  rare: { label: "稀有", labelEn: "Rare", color: "bg-blue-50 text-blue-700 border-blue-300", glow: "shadow-blue-200 shadow-md", icon: Sparkles },
  legendary: { label: "传说", labelEn: "Legendary", color: "bg-amber-50 text-amber-700 border-amber-300", glow: "shadow-amber-200 shadow-lg", icon: Crown },
};

const FRAME_STYLES: Record<string, string> = {
  bronze: "border-amber-600",
  silver: "border-gray-400",
  gold: "border-yellow-400 shadow-yellow-200 shadow-md",
  crystal: "border-cyan-300 shadow-cyan-200 shadow-md",
  flame: "border-red-500 shadow-red-300 shadow-lg animate-pulse",
  aurora: "border-purple-400 shadow-purple-300 shadow-lg",
};

const EFFECT_ICONS: Record<string, typeof Star> = {
  rest_day: BedDouble,
  skip_chore: Dumbbell,
  gaming_session: Gamepad2,
  treat_yourself: UtensilsCrossed,
  sleep_in: Clock,
};

const EFFECT_LABELS: Record<string, { zh: string; en: string }> = {
  rest_day: { zh: "休息日", en: "Rest Day" },
  skip_chore: { zh: "跳过家务", en: "Skip Chore" },
  gaming_session: { zh: "游戏时间", en: "Gaming Session" },
  treat_yourself: { zh: "犒劳自己", en: "Treat Yourself" },
  sleep_in: { zh: "睡懒觉", en: "Sleep In" },
};

const MILESTONES = [
  { id: "streak_7", name: "7日连击", nameEn: "7-Day Streak", description: "连续完成任务7天", descriptionEn: "Complete tasks 7 days in a row", type: "streak", target: 7, reward: "gaming_session", rarity: "common" as const },
  { id: "streak_14", name: "14日连击", nameEn: "14-Day Streak", description: "连续完成任务14天", descriptionEn: "Complete tasks 14 days in a row", type: "streak", target: 14, reward: "skip_chore", rarity: "rare" as const },
  { id: "streak_30", name: "30日连击", nameEn: "30-Day Streak", description: "连续完成任务30天", descriptionEn: "Complete tasks 30 days in a row", type: "streak", target: 30, reward: "rest_day", rarity: "rare" as const },
  { id: "streak_60", name: "60日连击", nameEn: "60-Day Streak", description: "连续完成任务60天", descriptionEn: "Complete tasks 60 days in a row", type: "streak", target: 60, reward: "treat_yourself", rarity: "legendary" as const },
  { id: "streak_100", name: "百日武者", nameEn: "100-Day Warrior", description: "连续完成任务100天", descriptionEn: "Complete tasks 100 days in a row", type: "streak", target: 100, reward: "title_100", rarity: "legendary" as const },
  { id: "xp_1000", name: "千分积累", nameEn: "1,000 XP", description: "累计获得1000经验值", descriptionEn: "Accumulate 1,000 total XP", type: "xp", target: 1000, reward: "sleep_in", rarity: "common" as const },
  { id: "xp_5000", name: "五千达成", nameEn: "5,000 XP", description: "累计获得5000经验值", descriptionEn: "Accumulate 5,000 total XP", type: "xp", target: 5000, reward: "rest_day", rarity: "rare" as const },
  { id: "xp_10000", name: "万分武者", nameEn: "10,000 XP", description: "累计获得10000经验值", descriptionEn: "Accumulate 10,000 total XP", type: "xp", target: 10000, reward: "title_legend", rarity: "legendary" as const },
];

function RarityBadge({ rarity }: { rarity: string }) {
  const config = RARITY_CONFIG[rarity as keyof typeof RARITY_CONFIG] || RARITY_CONFIG.common;
  const { t } = useLang();
  return (
    <Badge variant="outline" className={`text-[10px] ${config.color}`}>
      {t(config.label, config.labelEn)}
    </Badge>
  );
}

function ItemCard({
  item,
  owned,
  equipped,
  onBuy,
  onEquip,
  buying,
}: {
  item: any;
  owned: boolean;
  equipped: boolean;
  onBuy?: () => void;
  onEquip?: () => void;
  buying?: boolean;
}) {
  const { t } = useLang();
  const config = RARITY_CONFIG[item.rarity as keyof typeof RARITY_CONFIG] || RARITY_CONFIG.common;
  const Icon = config.icon;

  return (
    <Card className={`relative overflow-hidden transition-all hover:scale-[1.02] ${config.glow}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${config.color.split(" ")[0]}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#1f1a14]">{item.name}</p>
              <RarityBadge rarity={item.rarity} />
            </div>
          </div>
          {item.price && !owned && (
            <div className="flex items-center gap-1 text-sm font-semibold text-amber-600">
              <Star className="h-3.5 w-3.5" />
              {item.price}
            </div>
          )}
        </div>
        <p className="text-xs text-[#8a847a] mb-3">{item.description}</p>
        {owned ? (
          equipped ? (
            <Badge className="w-full justify-center bg-green-100 text-green-700 border-green-300">
              <Check className="h-3 w-3 mr-1" />
              {t("已装备", "Equipped")}
            </Badge>
          ) : (
            <Button size="sm" variant="outline" className="w-full" onClick={onEquip}>
              {t("装备", "Equip")}
            </Button>
          )
        ) : item.price ? (
          <Button size="sm" className="w-full bg-[#d17847] hover:bg-[#b8633a]" onClick={onBuy} disabled={buying}>
            {buying ? t("购买中...", "Buying...") : t("购买", "Buy")}
          </Button>
        ) : (
          <Badge variant="outline" className="w-full justify-center text-[#8a847a]">
            <Lock className="h-3 w-3 mr-1" />
            {t("仅限抽卡/成就", "Gacha/Milestone Only")}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}

function GachaAnimation({ results, onClose }: { results: any[]; onClose: () => void }) {
  const { t } = useLang();
  const [currentIndex, setCurrentIndex] = useState(0);
  const item = results[currentIndex];
  if (!item) return null;

  const shopItem = item.shop_items;
  const config = RARITY_CONFIG[shopItem?.rarity as keyof typeof RARITY_CONFIG] || RARITY_CONFIG.common;
  const Icon = config.icon;
  const isLast = currentIndex === results.length - 1;

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">
            {t("抽卡结果", "Pull Result")} ({currentIndex + 1}/{results.length})
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center py-6 gap-4">
          <div className={`w-20 h-20 rounded-2xl flex items-center justify-center ${config.color.split(" ")[0]} ${config.glow}`}>
            <Icon className="h-10 w-10" />
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-[#1f1a14]">{shopItem?.name}</p>
            <RarityBadge rarity={shopItem?.rarity || "common"} />
            <p className="text-sm text-[#8a847a] mt-2">{shopItem?.description}</p>
          </div>
          {item.is_new && (
            <Badge className="bg-amber-100 text-amber-700 border-amber-300">
              <Gift className="h-3 w-3 mr-1" />
              {t("新获得!", "New!")}
            </Badge>
          )}
        </div>
        <DialogFooter>
          {isLast ? (
            <Button onClick={onClose} className="w-full bg-[#d17847] hover:bg-[#b8633a]">
              {t("完成", "Done")}
            </Button>
          ) : (
            <Button onClick={() => setCurrentIndex(currentIndex + 1)} className="w-full bg-[#d17847] hover:bg-[#b8633a]">
              {t("下一个", "Next")} <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ShopPage() {
  const { t } = useLang();
  const [activeTab, setActiveTab] = useState("gacha");
  const [pullResults, setPullResults] = useState<any[] | null>(null);
  const [confirmBuy, setConfirmBuy] = useState<any>(null);

  const { data: shopItems = [] } = useShopItems();
  const { data: inventory = [] } = useUserInventory();
  const { data: pity } = useGachaPity();
  const { data: spendablePoints = 0 } = useSpendablePoints();
  const { data: userPoints } = useUserPoints();
  const pullGacha = usePullGacha();
  const buyFromShop = useBuyFromShop();
  const equipItem = useEquipItem();
  const useCoupon = useUseCoupon();

  const ownedItemIds = useMemo(() => new Set(inventory.map((inv: any) => inv.item_id)), [inventory]);
  const equippedMap = useMemo(() => {
    const map = new Map<string, string>();
    inventory.forEach((inv: any) => {
      if (inv.is_equipped && inv.shop_items?.item_type) {
        map.set(inv.shop_items.item_type, inv.id);
      }
    });
    return map;
  }, [inventory]);

  const handlePull = async (count: 1 | 10) => {
    try {
      const results = await pullGacha.mutateAsync(count);
      const enriched = results.map((r: any) => ({
        ...r,
        is_new: true,
      }));
      setPullResults(enriched);
    } catch (e: any) {
      // Error handled by mutation
    }
  };

  const handleBuy = async (itemId: string) => {
    try {
      await buyFromShop.mutateAsync(itemId);
      setConfirmBuy(null);
    } catch (e: any) {
      // Error handled by mutation
    }
  };

  const handleEquip = (inventoryId: string, itemType: string) => {
    equipItem.mutate({ inventoryId, itemType });
  };

  const handleUseCoupon = (inventoryId: string) => {
    useCoupon.mutate(inventoryId);
  };

  const directShopItems = useMemo(
    () => shopItems.filter((item: any) => item.price !== null && item.item_type !== "privilege_coupon"),
    [shopItems]
  );

  const currentStreak = userPoints?.current_streak || 0;
  const totalPoints = userPoints?.total_points || 0;

  const milestoneProgress = useMemo(() => {
    return MILESTONES.map((m) => {
      let current = 0;
      if (m.type === "streak") current = currentStreak;
      else if (m.type === "xp") current = totalPoints;
      const unlocked = current >= m.target;
      const progress = Math.min(100, (current / m.target) * 100);
      return { ...m, current, unlocked, progress };
    });
  }, [currentStreak, totalPoints]);

  return (
    <AppLayout title={t("商店", "Shop")}>
    <div className="pb-20 md:pb-4">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#1f1a14] mb-1">{t("商店", "Shop")}</h1>
          <p className="text-sm text-[#8a847a]">{t("用积分换取奖励", "Spend your XP on rewards")}</p>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card>
            <CardContent className="p-3 flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-500" />
              <div>
                <p className="text-xs text-[#8a847a]">{t("可用积分", "XP Balance")}</p>
                <p className="text-lg font-bold text-[#1f1a14]">{spendablePoints}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-xs text-[#8a847a]">{t("传说保底", "Legend Pity")}</p>
                <p className="text-lg font-bold text-[#1f1a14]">{pity?.pulls_since_legendary || 0}/15</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-xs text-[#8a847a]">{t("收藏进度", "Collection")}</p>
                <p className="text-lg font-bold text-[#1f1a14]">{inventory.length}/{shopItems.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-4 w-full mb-6">
            <TabsTrigger value="gacha" className="text-xs">
              <Zap className="h-3.5 w-3.5 mr-1" />
              {t("抽卡", "Gacha")}
            </TabsTrigger>
            <TabsTrigger value="shop" className="text-xs">
              <ShoppingBag className="h-3.5 w-3.5 mr-1" />
              {t("直购", "Shop")}
            </TabsTrigger>
            <TabsTrigger value="inventory" className="text-xs">
              <Package className="h-3.5 w-3.5 mr-1" />
              {t("背包", "Bag")}
            </TabsTrigger>
            <TabsTrigger value="milestones" className="text-xs">
              <Trophy className="h-3.5 w-3.5 mr-1" />
              {t("成就", "Goals")}
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Gacha */}
          <TabsContent value="gacha">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("抽卡机", "Gacha Machine")}</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Rate Display */}
                <div className="flex justify-center gap-4 mb-6 text-xs">
                  <span className="flex items-center gap-1">
                    <Shield className="h-3 w-3 text-gray-500" />
                    {t("普通", "Common")} 60%
                  </span>
                  <span className="flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-blue-500" />
                    {t("稀有", "Rare")} 30%
                  </span>
                  <span className="flex items-center gap-1">
                    <Crown className="h-3 w-3 text-amber-500" />
                    {t("传说", "Legendary")} 10%
                  </span>
                </div>

                {/* Pity Progress */}
                <div className="mb-6">
                  <div className="flex justify-between text-xs text-[#8a847a] mb-1">
                    <span>{t("传说保底计数", "Legendary Pity Counter")}</span>
                    <span>{pity?.pulls_since_legendary || 0} / 15</span>
                  </div>
                  <Progress value={((pity?.pulls_since_legendary || 0) / 15) * 100} className="h-2" />
                  <p className="text-[10px] text-[#8a847a] mt-1">
                    {t("第15抽必出传说", "Guaranteed legendary at pull 15")}
                  </p>
                </div>

                {/* Pull Buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    size="lg"
                    className="bg-[#d17847] hover:bg-[#b8633a]"
                    onClick={() => handlePull(1)}
                    disabled={pullGacha.isPending || spendablePoints < 100}
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    {t("单抽", "Pull x1")}
                    <span className="ml-2 text-xs opacity-80">
                      <Star className="h-3 w-3 inline" /> 100
                    </span>
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => handlePull(10)}
                    disabled={pullGacha.isPending || spendablePoints < 900}
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    {t("十连", "Pull x10")}
                    <span className="ml-2 text-xs opacity-80">
                      <Star className="h-3 w-3 inline" /> 900
                    </span>
                  </Button>
                </div>

                {spendablePoints < 100 && (
                  <p className="text-center text-xs text-red-500 mt-3">
                    {t("积分不足，完成更多任务来赚取积分吧！", "Not enough XP! Complete more tasks to earn points!")}
                  </p>
                )}

                {/* Pull History */}
                {pity?.total_pulls > 0 && (
                  <div className="mt-6 pt-4 border-t border-[#e4e1d7]">
                    <p className="text-xs text-[#8a847a] mb-2">
                      {t("总计抽卡次数", "Total Pulls")}: {pity.total_pulls}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 2: Direct Shop */}
          <TabsContent value="shop">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {directShopItems.length === 0 ? (
                <Card className="col-span-full">
                  <CardContent className="p-8 text-center text-[#8a847a]">
                    {t("暂无可购买的商品", "No items available for purchase")}
                  </CardContent>
                </Card>
              ) : (
                directShopItems.map((item: any) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    owned={ownedItemIds.has(item.id)}
                    equipped={equippedMap.get(item.item_type) === inventory.find((inv: any) => inv.item_id === item.id)?.id}
                    onBuy={() => setConfirmBuy(item)}
                    onEquip={() => {
                      const inv = inventory.find((i: any) => i.item_id === item.id);
                      if (inv) handleEquip(inv.id, item.item_type);
                    }}
                    buying={buyFromShop.isPending}
                  />
                ))
              )}
            </div>
          </TabsContent>

          {/* Tab 3: Inventory */}
          <TabsContent value="inventory">
            {inventory.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Package className="h-12 w-12 mx-auto mb-3 text-[#d1c9b8]" />
                  <p className="text-[#8a847a]">{t("背包空空如也！", "Your bag is empty!")}</p>
                  <p className="text-xs text-[#8a847a] mt-1">
                    {t("去抽卡或商店看看吧", "Visit the Gacha or Shop to get started")}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {inventory.map((inv: any) => {
                  const item = inv.shop_items;
                  if (!item) return null;

                  const isPrivilege = item.item_type === "privilege_coupon";
                  const EffectIcon = isPrivilege ? EFFECT_ICONS[item.metadata?.effect_type] || Gift : null;
                  const effectLabel = isPrivilege ? EFFECT_LABELS[item.metadata?.effect_type] : null;

                  return (
                    <Card key={inv.id} className={`overflow-hidden ${inv.is_used ? "opacity-50" : ""}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {isPrivilege && EffectIcon ? (
                              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-green-50">
                                <EffectIcon className="h-5 w-5 text-green-600" />
                              </div>
                            ) : (
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${(RARITY_CONFIG[item.rarity as keyof typeof RARITY_CONFIG] || RARITY_CONFIG.common).color.split(" ")[0]}`}>
                                {(RARITY_CONFIG[item.rarity as keyof typeof RARITY_CONFIG] || RARITY_CONFIG.common).icon && (
                                  <>{(() => { const I = (RARITY_CONFIG[item.rarity as keyof typeof RARITY_CONFIG] || RARITY_CONFIG.common).icon; return <I className="h-5 w-5" />; })()}</>
                                )}
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-medium text-[#1f1a14]">{item.name}</p>
                              <div className="flex gap-1">
                                <RarityBadge rarity={item.rarity} />
                                <Badge variant="outline" className="text-[10px] text-[#8a847a]">
                                  {inv.source === "gacha_pull" ? t("抽卡", "Gacha") : inv.source === "shop_purchase" ? t("直购", "Shop") : t("成就", "Milestone")}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-[#8a847a] mb-3">{item.description}</p>
                        {inv.is_used ? (
                          <Badge className="w-full justify-center bg-gray-100 text-gray-500">
                            <Check className="h-3 w-3 mr-1" />
                            {t("已使用", "Used")}
                          </Badge>
                        ) : isPrivilege ? (
                          <Button size="sm" className="w-full bg-green-600 hover:bg-green-700" onClick={() => handleUseCoupon(inv.id)}>
                            {effectLabel ? t(effectLabel.zh, effectLabel.en) : t("使用", "Use")}
                          </Button>
                        ) : inv.is_equipped ? (
                          <Badge className="w-full justify-center bg-green-100 text-green-700 border-green-300">
                            <Check className="h-3 w-3 mr-1" />
                            {t("已装备", "Equipped")}
                          </Badge>
                        ) : (
                          <Button size="sm" variant="outline" className="w-full" onClick={() => handleEquip(inv.id, item.item_type)}>
                            {t("装备", "Equip")}
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Tab 4: Milestones */}
          <TabsContent value="milestones">
            <div className="space-y-3">
              {milestoneProgress.map((m) => {
                const config = RARITY_CONFIG[m.rarity];
                const Icon = config.icon;
                return (
                  <Card key={m.id} className={m.unlocked ? "border-green-200 bg-green-50/30" : ""}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${m.unlocked ? "bg-green-100" : config.color.split(" ")[0]}`}>
                          {m.unlocked ? <Trophy className="h-5 w-5 text-green-600" /> : <Icon className="h-5 w-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-medium text-[#1f1a14]">{t(m.name, m.nameEn)}</p>
                            <RarityBadge rarity={m.rarity} />
                            {m.unlocked && (
                              <Badge className="bg-green-100 text-green-700 border-green-300 text-[10px]">
                                {t("已达成", "Unlocked")}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-[#8a847a] mb-2">{t(m.description, m.descriptionEn)}</p>
                          <div className="flex items-center gap-2">
                            <Progress value={m.progress} className="h-1.5 flex-1" />
                            <span className="text-[10px] text-[#8a847a] shrink-0">
                              {m.current}/{m.target}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Buy Confirmation Dialog */}
      <Dialog open={!!confirmBuy} onOpenChange={() => setConfirmBuy(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("确认购买", "Confirm Purchase")}</DialogTitle>
          </DialogHeader>
          {confirmBuy && (
            <div className="py-4">
              <p className="text-sm text-[#1f1a14] mb-2">{confirmBuy.name}</p>
              <p className="text-xs text-[#8a847a] mb-4">{confirmBuy.description}</p>
              <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                <span className="text-sm text-[#8a847a]">{t("花费", "Cost")}</span>
                <span className="flex items-center gap-1 font-semibold text-amber-600">
                  <Star className="h-4 w-4" /> {confirmBuy.price} XP
                </span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmBuy(null)}>
              {t("取消", "Cancel")}
            </Button>
            <Button
              className="bg-[#d17847] hover:bg-[#b8633a]"
              onClick={() => confirmBuy && handleBuy(confirmBuy.id)}
              disabled={buyFromShop.isPending}
            >
              {buyFromShop.isPending ? t("购买中...", "Buying...") : t("确认购买", "Confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Gacha Results Dialog */}
      {pullResults && <GachaAnimation results={pullResults} onClose={() => setPullResults(null)} />}
    </div>
    </AppLayout>
  );
}
