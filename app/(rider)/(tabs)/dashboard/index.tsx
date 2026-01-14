// // app/(rider)/(tabs)/dashboard/index.tsx
// import { Ionicons } from "@expo/vector-icons";
// import { router } from "expo-router";
// import React, { useEffect, useRef, useState } from "react";
// import {
//   Animated,
//   Dimensions,
//   Easing,
//   FlatList,
//   RefreshControl,
//   ScrollView,
//   StyleSheet,
//   Text,
//   TouchableOpacity,
//   View,
// } from "react-native";
// import { Skeleton } from "../../../../components/ui/Skeleton";
// import { useTheme } from "../../../../context/ThemeContext";
// import { useFadeSlide } from "../../../../hooks/useFadeSlide";

// const { width } = Dimensions.get("window");
// const CARD_WIDTH = width - 48;
// const H_CARD = Math.min(320, width * 0.85);

// type Order = {
//   id: string;
//   kind: "pickup" | "delivery";
//   priority: number; // higher = show in top "upcoming"
//   eta?: string; // e.g. "in 12 min"
//   time: string;
//   status: "Delivered" | "Pending" | "Active";
//   price: string;
//   distance?: string;
//   address?: string;
//   to?: string;
//   from?: string;
// };

// /* ---------- sample data ---------- */
// const SAMPLE_ORDERS: Order[] = [
//   // priority upcoming pickups
//   {
//     id: "ORD-PICK-001",
//     kind: "pickup",
//     priority: 9,
//     eta: "in 8 min",
//     time: "Today, 1:45 PM",
//     status: "Active",
//     price: "₹90",
//     distance: "2.1 km",
//     address: "Green Valley Apts",
//   },
//   {
//     id: "ORD-PICK-002",
//     kind: "pickup",
//     priority: 7,
//     eta: "in 14 min",
//     time: "Today, 2:10 PM",
//     status: "Pending",
//     price: "₹120",
//     distance: "3.2 km",
//     address: "Sunshine Towers",
//   },

//   // upcoming deliveries
//   {
//     id: "ORD-DEL-001",
//     kind: "delivery",
//     priority: 8,
//     eta: "in 11 min",
//     time: "Today, 1:55 PM",
//     status: "Active",
//     price: "₹180",
//     distance: "3.9 km",
//     to: "Pune Market",
//     from: "Warehouse A",
//   },

//   // history (lower priority)
//   {
//     id: "ORD-HIST-101",
//     kind: "pickup",
//     priority: 1,
//     time: "Yesterday, 7:10 PM",
//     status: "Delivered",
//     price: "₹295",
//     distance: "3.2 km",
//     address: "Royal Residency",
//   },
//   {
//     id: "ORD-HIST-102",
//     kind: "delivery",
//     priority: 1,
//     time: "Yesterday, 6:05 PM",
//     status: "Delivered",
//     price: "₹340",
//     to: "Shivaji Nagar Apt 101",
//     from: "Pharmacy",
//   },
// ];

// export default function Dashboard() {
//   const { theme } = useTheme();

//   const [loading, setLoading] = useState(true);
//   const [orders, setOrders] = useState<Order[]>([]);
//   const [refreshing, setRefreshing] = useState(false);

//   // animate KPI and header
//   const kpi = useFadeSlide(0, 20);

//   // per-item animation refs
//   const itemOpacities = useRef<Record<string, Animated.Value>>({}).current;
//   const itemTranslates = useRef<Record<string, Animated.Value>>({}).current;

//   useEffect(() => {
//     // simulate fetch
//     const t = setTimeout(() => {
//       setOrders(SAMPLE_ORDERS);
//       setLoading(false);

//       // init animations
//       SAMPLE_ORDERS.forEach((o, i) => {
//         itemOpacities[o.id] = new Animated.Value(0);
//         itemTranslates[o.id] = new Animated.Value(18);
//       });

//       // stagger visible items first: show highest-priority items first
//       const ordered = [...SAMPLE_ORDERS].sort(
//         (a, b) => b.priority - a.priority
//       );
//       Animated.stagger(
//         80,
//         ordered.map((o) =>
//           Animated.parallel([
//             Animated.timing(itemOpacities[o.id], {
//               toValue: 1,
//               duration: 380,
//               easing: Easing.out(Easing.cubic),
//               useNativeDriver: true,
//             }),
//             Animated.timing(itemTranslates[o.id], {
//               toValue: 0,
//               duration: 420,
//               easing: Easing.out(Easing.cubic),
//               useNativeDriver: true,
//             }),
//           ])
//         )
//       ).start();
//     }, 600);

//     return () => clearTimeout(t);
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);

//   const onRefresh = () => {
//     setRefreshing(true);
//     setTimeout(() => {
//       setRefreshing(false);
//       // ideally fetch new orders here
//     }, 900);
//   };

//   if (loading) {
//     return (
//       <ScrollView
//         style={[styles.container, { backgroundColor: theme.background }]}
//         contentContainerStyle={{ paddingTop: 18, paddingBottom: 120 }}
//       >
//         <View style={styles.topRow}>
//           <Skeleton
//             height={64}
//             radius={12}
//             style={{ width: CARD_WIDTH * 0.62 }}
//           />
//           <Skeleton height={40} radius={12} style={{ width: 80 }} />
//         </View>

//         <View style={{ paddingHorizontal: 16 }}>
//           <Text
//             style={[
//               styles.sectionTitleSmall,
//               { color: theme.subText, marginTop: 18 },
//             ]}
//           >
//             Upcoming
//           </Text>
//           <Skeleton height={H_CARD} radius={14} style={{ marginTop: 12 }} />
//           <Skeleton height={H_CARD} radius={14} style={{ marginTop: 12 }} />
//           <Text
//             style={[
//               styles.sectionTitleSmall,
//               { color: theme.subText, marginTop: 18 },
//             ]}
//           >
//             History
//           </Text>
//           <Skeleton height={90} radius={12} style={{ marginTop: 12 }} />
//           <Skeleton height={90} radius={12} style={{ marginTop: 12 }} />
//         </View>
//       </ScrollView>
//     );
//   }

//   /* ---------- helpers: split orders ---------- */
//   const upcomingPickups = orders
//     .filter((o) => o.kind === "pickup" && o.priority >= 7)
//     .sort((a, b) => b.priority - a.priority);
//   const upcomingDeliveries = orders
//     .filter((o) => o.kind === "delivery" && o.priority >= 7)
//     .sort((a, b) => b.priority - a.priority);
//   const history = orders.filter((o) => o.priority < 7);

//   /* ---------- render ---------- */
//   return (
// //     <FlatList
// //   style={{ flex: 1, backgroundColor: theme.background }}
// //   data={history}
// //   keyExtractor={(i) => i.id}
// //   showsVerticalScrollIndicator={false}
// //   contentContainerStyle={{ paddingTop: 8, paddingBottom: 120 }}
// //   refreshControl={
// //     <RefreshControl
// //       refreshing={refreshing}
// //       onRefresh={onRefresh}
// //       tintColor={theme.primary}
// //     />
// //   }
// //   ListHeaderComponent={
// //     <>
// //       <SectionHeader
// //         title="Priority Pickups"
// //         subtitle={upcomingPickups.length ? `${upcomingPickups.length} waiting` : "None"}
// //       />
// //       {upcomingPickups.length > 0 ? (
// //         <FlatList
// //           data={upcomingPickups}
// //           horizontal
// //           showsHorizontalScrollIndicator={false}
// //           contentContainerStyle={{ paddingHorizontal: 14, gap: 12 }}
// //           snapToAlignment="start"
// //           decelerationRate="fast"
// //           snapToInterval={H_CARD + 12}
// //           renderItem={({ item }) => (
// //             <Animated.View
// //               style={{
// //                 opacity: itemOpacities[item.id] ?? 1,
// //                 transform: [{ translateY: itemTranslates[item.id] ?? 0 }],
// //               }}
// //             >
// //               <UpcomingCard
// //                 order={item}
// //                 theme={theme}
// //                 onPress={() => router.push(`/(rider)/order/pickup/${item.id}`)}
// //               />
// //             </Animated.View>
// //           )}
// //           keyExtractor={(i) => i.id}
// //         />
// //       ) : (
// //         <EmptyMini label="No immediate pickups" />
// //       )}
// //       {/* Upcoming deliveries */}
// //       <SectionHeader
// //         title="Priority Deliveries"
// //         subtitle={upcomingDeliveries.length ? `${upcomingDeliveries.length} waiting` : "None"}
// //       />
// //       {upcomingDeliveries.length > 0 ? (
// //         <FlatList
// //           data={upcomingDeliveries}
// //           horizontal
// //           showsHorizontalScrollIndicator={false}
// //           contentContainerStyle={{ paddingHorizontal: 14, gap: 12 }}
// //           snapToInterval={H_CARD + 12}
// //           decelerationRate="fast"
// //           renderItem={({ item }) => (
// //             <Animated.View
// //               style={{
// //                 opacity: itemOpacities[item.id] ?? 1,
// //                 transform: [{ translateY: itemTranslates[item.id] ?? 0 }],
// //               }}
// //             >
// //               <UpcomingCard
// //                 order={item}
// //                 theme={theme}
// //                 onPress={() => router.push(`/(rider)/order/delivered/${item.id}`)}
// //               />
// //             </Animated.View>
// //           )}
// //           keyExtractor={(i) => i.id}
// //         />
// //       ) : (
// //         <EmptyMini label="No immediate deliveries" />
// //       )}
// //       {/* Top Row (wallet + rating) */}
// //       <Animated.View
// //         style={[
// //           styles.topRow,
// //           { opacity: kpi.opacity, transform: [{ translateY: kpi.translateY }] },
// //         ]}
// //       >
// //         <View style={[styles.pill, { backgroundColor: theme.card, borderColor: theme.border }]}>
// //           <Text style={[styles.pillTitle, { color: theme.subText }]}>WALLET</Text>
// //           <Text style={[styles.pillValue, { color: theme.text }]}>₹6,320</Text>
// //         </View>
// //         <View style={[styles.ratingBox, { backgroundColor: theme.card }]}>
// //           <Ionicons name="star" size={12} color="#FACC15" />
// //           <Text style={[styles.ratingText, { color: theme.text }]}>4.8</Text>
// //         </View>
// //       </Animated.View>
// //       {/* KPI Cards */}
// //       <Animated.View
// //         style={[
// //           styles.kpiContainer,
// //           { opacity: kpi.opacity, transform: [{ translateY: kpi.translateY }] },
// //         ]}
// //       >
// //         <KpiCard title="TODAY ORDERS" value="12" theme={theme} />
// //         <KpiCard title="TOTAL ORDERS" value="1,247" theme={theme} />
// //       </Animated.View>
// //       <Animated.View
// //         style={[
// //           styles.kpiContainer,
// //           { opacity: kpi.opacity, transform: [{ translateY: kpi.translateY }] },
// //         ]}
// //       >
// //         <KpiCard title="KM TODAY" value="48.5 km" theme={theme} />
// //         <KpiCard title="TOTAL KM" value="18.4k km" theme={theme} />
// //       </Animated.View>
// //       {/* Upcoming pickups: horizontal prioritized carousel (show 1-2) */}
// //       {/* Order history header */}
// //       {/* <View style={styles.sectionHeader}>
// //         <Text style={[styles.sectionTitle, { color: theme.text }]}>Order History</Text>
// //         <TouchableOpacity onPress={() => router.push("/(rider)/order")}>
// //           <Text style={[styles.viewAll, { color: theme.primary }]}>View All</Text>
// //         </TouchableOpacity>
// //       </View> */}
// //     </>
// //   }
// //   // renderItem={({ item }) => (
// //   // <AnimatedOrderRow order={item} theme={theme} opacity={itemOpacities[item.id] ?? new Animated.Value(1)} translateY={itemTranslates[item.id] ?? new Animated.Value(0)} />
// //   // )}
// //   // ListEmptyComponent={<EmptyList theme={theme} />}
// //   renderItem={null}
// // />

//     <FlatList
//       style={{ flex: 1, backgroundColor: theme.background }}
//       data={[]} // ✅ IMPORTANT: prevents empty space
//       keyExtractor={() => "dashboard-header"}
//       showsVerticalScrollIndicator={false}
//       contentContainerStyle={{
//         paddingTop: 8,
//         paddingBottom: 24, // ✅ reduced bottom space
//       }}
//       refreshControl={
//         <RefreshControl
//           refreshing={refreshing}
//           onRefresh={onRefresh}
//           tintColor={theme.primary}
//         />
//       }
//       ListHeaderComponent={
//         <>
//           {/* Priority Pickups */}
//           <SectionHeader
//             title="Priority Pickups"
//             subtitle={
//               upcomingPickups.length
//                 ? `${upcomingPickups.length} waiting`
//                 : "None"
//             }
//           />

//           {upcomingPickups.length > 0 ? (
//             <FlatList
//               data={upcomingPickups}
//               horizontal
//               showsHorizontalScrollIndicator={false}
//               contentContainerStyle={{ paddingHorizontal: 14, gap: 12 }}
//               snapToAlignment="start"
//               decelerationRate="fast"
//               snapToInterval={H_CARD + 12}
//               renderItem={({ item }) => (
//                 <Animated.View
//                   style={{
//                     opacity: itemOpacities[item.id] ?? 1,
//                     transform: [{ translateY: itemTranslates[item.id] ?? 0 }],
//                   }}
//                 >
//                   <UpcomingCard
//                     order={item}
//                     theme={theme}
//                     onPress={() =>
//                       router.push(`/(rider)/order/pickup/${item.id}`)
//                     }
//                   />
//                 </Animated.View>
//               )}
//               keyExtractor={(i) => i.id}
//             />
//           ) : (
//             <EmptyMini label="No immediate pickups" />
//           )}

//           {/* Priority Deliveries */}
//           <SectionHeader
//             title="Priority Deliveries"
//             subtitle={
//               upcomingDeliveries.length
//                 ? `${upcomingDeliveries.length} waiting`
//                 : "None"
//             }
//           />

//           {upcomingDeliveries.length > 0 ? (
//             <FlatList
//               data={upcomingDeliveries}
//               horizontal
//               showsHorizontalScrollIndicator={false}
//               contentContainerStyle={{ paddingHorizontal: 14, gap: 12 }}
//               snapToInterval={H_CARD + 12}
//               decelerationRate="fast"
//               renderItem={({ item }) => (
//                 <Animated.View
//                   style={{
//                     opacity: itemOpacities[item.id] ?? 1,
//                     transform: [{ translateY: itemTranslates[item.id] ?? 0 }],
//                   }}
//                 >
//                   <UpcomingCard
//                     order={item}
//                     theme={theme}
//                     onPress={() =>
//                       router.push(`/(rider)/order/delivered/${item.id}`)
//                     }
//                   />
//                 </Animated.View>
//               )}
//               keyExtractor={(i) => i.id}
//             />
//           ) : (
//             <EmptyMini label="No immediate deliveries" />
//           )}

//           {/* Wallet + Rating */}
//           <Animated.View
//             style={[
//               styles.topRow,
//               {
//                 opacity: kpi.opacity,
//                 transform: [{ translateY: kpi.translateY }],
//               },
//             ]}
//           >
//             <View
//               style={[
//                 styles.pill,
//                 { backgroundColor: theme.card, borderColor: theme.border },
//               ]}
//             >
//               <Text style={[styles.pillTitle, { color: theme.subText }]}>
//                 WALLET
//               </Text>
//               <Text style={[styles.pillValue, { color: theme.text }]}>
//                 ₹6,320
//               </Text>
//             </View>

//             <View style={[styles.ratingBox, { backgroundColor: theme.card }]}>
//               <Ionicons name="star" size={12} color="#FACC15" />
//               <Text style={[styles.ratingText, { color: theme.text }]}>
//                 4.8
//               </Text>
//             </View>
//           </Animated.View>

//           {/* KPI Cards */}
//           <Animated.View
//             style={[
//               styles.kpiContainer,
//               {
//                 opacity: kpi.opacity,
//                 transform: [{ translateY: kpi.translateY }],
//               },
//             ]}
//           >
//             <KpiCard title="TODAY ORDERS" value="12" theme={theme} />
//             <KpiCard title="TOTAL ORDERS" value="1,247" theme={theme} />
//           </Animated.View>

//           <Animated.View
//             style={[
//               styles.kpiContainer,
//               {
//                 opacity: kpi.opacity,
//                 transform: [{ translateY: kpi.translateY }],
//               },
//             ]}
//           >
//             <KpiCard title="KM TODAY" value="48.5 km" theme={theme} />
//             <KpiCard title="TOTAL KM" value="18.4k km" theme={theme} />
//           </Animated.View>
//         </>
//       }
//       renderItem={null}
//     />
//   );
// }

// /* ---------- small components ---------- */

// function SectionHeader({
//   title,
//   subtitle,
// }: {
//   title: string;
//   subtitle?: string;
// }) {
//   return (
//     <View
//       style={{
//         paddingHorizontal: 16,
//         marginTop: 18,
//         marginBottom: 6,
//         flexDirection: "row",
//         justifyContent: "space-between",
//         alignItems: "center",
//       }}
//     >
//       <Text style={{ fontSize: 16, fontWeight: "800" }}>{title}</Text>
//       {subtitle ? (
//         <Text style={{ fontSize: 13, color: "#94A3B8", fontWeight: "700" }}>
//           {subtitle}
//         </Text>
//       ) : null}
//     </View>
//   );
// }

// function UpcomingCard({
//   order,
//   theme,
//   onPress,
// }: {
//   order: Order;
//   theme: any;
//   onPress: () => void;
// }) {
//   return (
//     <TouchableOpacity
//       activeOpacity={0.9}
//       onPress={onPress}
//       style={[
//         styles.upcomingCard,
//         {
//           width: H_CARD,
//           backgroundColor: theme.card,
//           borderColor: theme.border,
//         },
//       ]}
//     >
//       <View
//         style={{
//           flexDirection: "row",
//           justifyContent: "space-between",
//           alignItems: "flex-start",
//         }}
//       >
//         <View>
//           <Text style={{ fontWeight: "900", fontSize: 16, color: theme.text }}>
//             {order.kind === "pickup" ? "Pickup" : "Delivery"}
//           </Text>
//           <Text style={{ marginTop: 6, color: theme.subText }}>
//             {order.address ?? order.to}
//           </Text>
//           <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
//             <View style={styles.pillMini}>
//               <Text style={{ fontWeight: "800", color: "#065F46" }}>
//                 {order.eta ?? order.time}
//               </Text>
//             </View>
//             <View style={styles.pillMiniOutline}>
//               <Text style={{ fontWeight: "800", color: theme.primary }}>
//                 {order.distance ?? ""}
//               </Text>
//             </View>
//           </View>
//         </View>

//         <View style={{ alignItems: "flex-end" }}>
//           <Text style={{ fontWeight: "900", color: theme.primary }}>
//             {order.price}
//           </Text>
//           <View
//             style={{
//               marginTop: 12,
//               backgroundColor: "#F0FDF4",
//               paddingHorizontal: 8,
//               paddingVertical: 6,
//               borderRadius: 999,
//             }}
//           >
//             <Text style={{ color: "#166534", fontWeight: "800" }}>
//               {order.status}
//             </Text>
//           </View>
//         </View>
//       </View>
//     </TouchableOpacity>
//   );
// }

// function EmptyMini({ label }: { label: string }) {
//   return (
//     <View style={{ paddingHorizontal: 16 }}>
//       <View
//         style={{
//           padding: 12,
//           borderRadius: 12,
//           backgroundColor: "#0F172A10",
//           marginBottom: 6,
//         }}
//       >
//         <Text style={{ color: "#64748B" }}>{label}</Text>
//       </View>
//     </View>
//   );
// }

// function EmptyList({ theme }: { theme: any }) {
//   return (
//     <View style={{ padding: 16 }}>
//       <Text style={{ color: theme.subText }}>
//         No orders yet — pull to refresh
//       </Text>
//     </View>
//   );
// }

// function KpiCard({
//   title,
//   value,
//   theme,
// }: {
//   title: string;
//   value: string;
//   theme: any;
// }) {
//   return (
//     <View
//       style={[
//         styles.kpiCard,
//         { backgroundColor: theme.card, borderColor: theme.border },
//       ]}
//     >
//       <Text style={[styles.kpiTitle, { color: theme.subText }]}>{title}</Text>
//       <Text style={[styles.kpiValue, { color: theme.text }]}>{value}</Text>
//     </View>
//   );
// }

// function AnimatedOrderRow({
//   order,
//   theme,
//   translateY,
//   opacity,
// }: {
//   order: Order;
//   theme: any;
//   translateY: Animated.Value;
//   opacity: Animated.Value;
// }) {
//   const scale = useRef(new Animated.Value(1)).current;
//   const onPressIn = () =>
//     Animated.spring(scale, {
//       toValue: 0.98,
//       useNativeDriver: true,
//       friction: 6,
//     }).start();
//   const onPressOut = () =>
//     Animated.spring(scale, {
//       toValue: 1,
//       useNativeDriver: true,
//       friction: 6,
//     }).start();

//   const onPress = () => {
//     router.push({
//       pathname:
//         order.kind === "pickup"
//           ? "/(rider)/order/pickup/[orderId]"
//           : "/(rider)/order/delivered/[orderId]",
//       params: { orderId: order.id },
//     });
//   };

//   const statusColor =
//     order.status === "Delivered"
//       ? "#16A34A"
//       : order.status === "Active"
//       ? "#06B6D4"
//       : "#F59E0B";

//   return (
//     <Animated.View style={{ opacity, transform: [{ translateY }] }}>
//       <Animated.View
//         style={[
//           styles.orderCard,
//           {
//             backgroundColor: theme.card,
//             borderColor: theme.border,
//             transform: [{ scale }],
//           },
//         ]}
//       >
//         <TouchableOpacity
//           activeOpacity={0.95}
//           onPressIn={onPressIn}
//           onPressOut={onPressOut}
//           onPress={onPress}
//           style={{ flexDirection: "row", alignItems: "center" }}
//         >
//           <View style={styles.orderLeft}>
//             <View
//               style={[
//                 styles.orderIconWrap,
//                 { backgroundColor: theme.background },
//               ]}
//             >
//               <Ionicons
//                 name={order.kind === "pickup" ? "locate" : "cube"}
//                 size={18}
//                 color={theme.primary}
//               />
//             </View>
//           </View>

//           <View style={styles.orderCenter}>
//             <Text style={[styles.orderId, { color: theme.text }]}>
//               {order.id}
//             </Text>
//             <Text style={[styles.orderTime, { color: theme.subText }]}>
//               {order.time} · {order.eta ?? ""}
//             </Text>
//             <Text
//               style={[styles.orderMeta, { color: theme.subText }]}
//               numberOfLines={1}
//             >
//               {order.kind === "pickup"
//                 ? order.address
//                 : `${order.to} • ${order.from ?? ""}`}
//             </Text>
//           </View>

//           <View style={styles.orderRight}>
//             <Text style={[styles.orderPrice, { color: theme.primary }]}>
//               {order.price}
//             </Text>
//             <View
//               style={[
//                 styles.statusPill,
//                 {
//                   backgroundColor: statusColor + "22",
//                   borderColor: statusColor,
//                 },
//               ]}
//             >
//               <Text style={[styles.statusText, { color: statusColor }]}>
//                 {order.status}
//               </Text>
//             </View>
//           </View>
//         </TouchableOpacity>
//       </Animated.View>
//     </Animated.View>
//   );
// }

// /* ---------- styles ---------- */

// const styles = StyleSheet.create({
//   container: { flex: 1 },

//   topRow: {
//     marginTop: 20,
//     paddingHorizontal: 16,
//     marginBottom: 10,
//     flexDirection: "row",
//     justifyContent: "space-between",
//     alignItems: "center",
//   },

//   pill: {
//     padding: 12,
//     borderRadius: 12,
//     width: CARD_WIDTH * 0.62,
//     borderWidth: 1,
//   },
//   pillTitle: { fontSize: 12, fontWeight: "700", opacity: 0.9 },
//   pillValue: { fontSize: 18, fontWeight: "900", marginTop: 8 },

//   ratingBox: {
//     paddingHorizontal: 12,
//     paddingVertical: 8,
//     borderRadius: 12,
//     alignItems: "center",
//     flexDirection: "row",
//   },
//   ratingText: { marginLeft: 6, fontWeight: "800" },

//   kpiContainer: {
//     paddingHorizontal: 16,
//     marginTop: 6,
//     flexDirection: "row",
//     justifyContent: "space-between",
//   },
//   kpiCard: {
//     width: "48%",
//     padding: 14,
//     borderRadius: 14,
//     borderWidth: 1,
//   },
//   kpiTitle: { fontSize: 11, fontWeight: "700", marginBottom: 6 },
//   kpiValue: { fontSize: 20, fontWeight: "900" },

//   upcomingCard: {
//     borderRadius: 14,
//     padding: 16,
//     marginRight: 12,
//     borderWidth: 1,
//     minHeight: H_CARD * 0.45,
//     justifyContent: "center",
//     shadowColor: "#000",
//     shadowOpacity: 0.06,
//     shadowRadius: 10,
//     shadowOffset: { width: 0, height: 6 },
//     elevation: 3,
//   },

//   pillMini: {
//     backgroundColor: "#ECFDF5",
//     paddingHorizontal: 8,
//     paddingVertical: 6,
//     borderRadius: 999,
//   },
//   pillMiniOutline: {
//     borderWidth: 1,
//     borderColor: "#10B981",
//     paddingHorizontal: 8,
//     paddingVertical: 6,
//     borderRadius: 999,
//   },

//   sectionHeader: {
//     paddingHorizontal: 14,
//     marginTop: 8,
//     marginBottom: 6,
//     flexDirection: "row",
//     justifyContent: "space-between",
//     alignItems: "center",
//   },
//   sectionTitle: { fontSize: 16, fontWeight: "800" },
//   sectionTitleSmall: { fontSize: 14, fontWeight: "800" },
//   viewAll: { fontSize: 13, fontWeight: "700" },

//   orderCard: {
//     marginHorizontal: 16,
//     padding: 8,
//     borderRadius: 14,
//     borderWidth: 1,
//     flexDirection: "row",
//     alignItems: "center",
//     marginBottom: 12,
//     shadowColor: "#000",
//     shadowOpacity: 0.04,
//     shadowRadius: 8,
//     shadowOffset: { width: 0, height: 4 },
//     elevation: 2,
//   },
//   orderLeft: { width: 48, alignItems: "center" },
//   orderIconWrap: {
//     width: 40,
//     height: 32,
//     borderRadius: 10,
//     alignItems: "center",
//     justifyContent: "center",
//   },
//   orderCenter: { flex: 1, paddingHorizontal: 8 },

//   orderId: { fontWeight: "800", marginBottom: 4 },
//   orderTime: { fontSize: 12 },
//   orderMeta: { fontSize: 12, marginTop: 4 },

//   orderRight: { alignItems: "flex-end", width: 110 },
//   orderPrice: { fontWeight: "900", fontSize: 16, marginBottom: 6 },

//   statusPill: {
//     paddingHorizontal: 8,
//     paddingVertical: 6,
//     borderRadius: 999,
//     borderWidth: 1,
//   },
//   statusText: { fontWeight: "800", fontSize: 12 },
// });

// app/(rider)/(tabs)/dashboard/index.tsx
// app/(rider)/(tabs)/dashboard/index.tsx
import { useAuth } from "@/context/useAuth";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Skeleton } from "../../../../components/ui/Skeleton";
import { useTheme } from "../../../../context/ThemeContext";
import { useFadeSlide } from "../../../../hooks/useFadeSlide";

const { width } = Dimensions.get("window");
const CARD_WIDTH = width - 48;
const H_CARD = Math.min(320, width * 0.85);

// API bases
const PICKUP_API_BASE = "https://api.drydash.in/api/v1/rider";
const ORDERS_API_BASE = "https://api.drydash.in/api/v1";

type Order = {
  id: string;
  kind: "pickup" | "delivery";
  priority: number;
  time: string;
  status: "Active" | "Pending" | "Delivered";
  // pickups
  name?: string;
  address?: string;
  contact?: string;
  // deliveries
  to?: string;
  from?: string;
  lat?: number | null;
  lng?: number | null;
  price?: string;
  distance?: string;
};

export default function Dashboard() {
  const { theme } = useTheme();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [pickups, setPickups] = useState<Order[]>([]);
  const [deliveries, setDeliveries] = useState<Order[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // animate KPI and header
  const kpi = useFadeSlide(0, 20);

  // animation refs keyed by order id (works for both pickups + deliveries)
  const itemOpacities = useRef<Record<string, Animated.Value>>({}).current;
  const itemTranslates = useRef<Record<string, Animated.Value>>({}).current;

  /* ---------- mapping helpers ---------- */

  const mapPickupToOrder = (p: any): Order => {
    let priority = 4;
    if (p.type === "live") priority = 10;
    else if (p.PickupStatus === "assigned") priority = 9;
    else if (p.isRescheduled) priority = 6;

    const status =
      p.PickupStatus === "completed"
        ? "Delivered"
        : p.PickupStatus === "assigned"
        ? "Active"
        : "Pending";

    return {
      id: p._id,
      kind: "pickup",
      priority,
      time: "Today",
      status,
      name: p.Name || "Customer",
      address: p.Address || p.plantName || "Address not available",
      contact: p.Contact || "N/A",
    };
  };

  const mapOrderToDelivery = (o: any): Order => {
    const status =
      o.status && o.status.includes("assigned")
        ? "Active"
        : o.status === "delivered"
        ? "Delivered"
        : "Pending";
    return {
      id: o._id,
      kind: "delivery",
      priority: 7,
      time: o.createdAt ? new Date(o.createdAt).toLocaleString() : "Today",
      status,
      to: o.customerName || "Customer",
      from: o.order_id,
      contact: o.contactNo || "N/A",
      address: o.address || "Address not available",
      lat: o.orderLocation?.latitude ?? null,
      lng: o.orderLocation?.longitude ?? null,
      price: o.price ? `₹${o.price}` : undefined,
    };
  };

  /* ---------- fetch functions ---------- */

  const getPickups = async () => {
    if (!user?.email) {
      setPickups([]);
      return;
    }

    try {
      const res = await fetch(
        `${PICKUP_API_BASE}/getriderpickups?email=${encodeURIComponent(
          user.email
        )}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "x-client-type": "mobile",
          },
        }
      );

      const json = await res.json();
      if (!res.ok) {
        console.warn("Pickups API non-ok:", json);
        setPickups([]);
        return;
      }

      const raw = Array.isArray(json.Pickups) ? json.Pickups : [];
      const mapped = raw.map(mapPickupToOrder);

      // keep only top 5 by priority
      const sorted = mapped.sort((a: any, b: any) => b.priority - a.priority);
      const top = sorted.slice(0, 5);

      // init animation refs for pickups
      top.forEach((o: any) => {
        if (!itemOpacities[o.id]) itemOpacities[o.id] = new Animated.Value(0);
        if (!itemTranslates[o.id])
          itemTranslates[o.id] = new Animated.Value(18);
      });

      // animate pickups in
      Animated.stagger(
        60,
        top.map((o: any) =>
          Animated.parallel([
            Animated.timing(itemOpacities[o.id], {
              toValue: 1,
              duration: 360,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(itemTranslates[o.id], {
              toValue: 0,
              duration: 400,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
          ])
        )
      ).start();

      setPickups(top);
    } catch (err) {
      console.error("getPickups error:", err);
      setPickups([]);
    }
  };

  const fetchDeliveries = async () => {
    if (!user?.email) {
      setDeliveries([]);
      return;
    }

    try {
      const res = await fetch(
        `${ORDERS_API_BASE}/getOrdersByFilter?email=${encodeURIComponent(
          user.email
        )}&status=delivery+rider+assigned&limit=1000&page=1`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "x-client-type": "mobile",
          },
        }
      );

      const json = await res.json();
      if (!res.ok) {
        console.warn("Deliveries API non-ok:", json);
        setDeliveries([]);
        return;
      }

      const raw = Array.isArray(json.orders) ? json.orders : [];
      const mapped = raw.map(mapOrderToDelivery);

      // init animation refs for deliveries
      mapped.forEach((o: any) => {
        if (!itemOpacities[o.id]) itemOpacities[o.id] = new Animated.Value(1); // visible (we'll animate with page)
        if (!itemTranslates[o.id]) itemTranslates[o.id] = new Animated.Value(0);
      });

      setDeliveries(mapped);
    } catch (err) {
      console.error("fetchDeliveries error:", err);
      setDeliveries([]);
    }
  };

  /* ---------- combined loader + effect ---------- */

  const loadAll = async () => {
    setLoading(true);
    try {
      await Promise.all([getPickups(), fetchDeliveries()]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!user?.email) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email]);

  const onRefresh = () => {
    setRefreshing(true);
    loadAll();
  };

  /* ---------- render helpers ---------- */

  const upcomingPickups = pickups
    .slice()
    .sort((a, b) => b.priority - a.priority);
  const upcomingDeliveries = deliveries
    .slice()
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
    .slice(0, 5);

  if (loading) {
    return (
      <ScrollView
        style={[styles.container, { backgroundColor: theme.background }]}
        contentContainerStyle={{ paddingTop: 18, paddingBottom: 120 }}
      >
        <View style={styles.topRow}>
          <Skeleton
            height={64}
            radius={12}
            style={{ width: CARD_WIDTH * 0.62 }}
          />
          <Skeleton height={40} radius={12} style={{ width: 80 }} />
        </View>

        <View style={{ paddingHorizontal: 16 }}>
          <Text
            style={[
              styles.sectionTitleSmall,
              { color: theme.subText, marginTop: 18 },
            ]}
          >
            Upcoming
          </Text>
          <Skeleton height={H_CARD} radius={14} style={{ marginTop: 12 }} />
          <Skeleton height={H_CARD} radius={14} style={{ marginTop: 12 }} />
          <Text
            style={[
              styles.sectionTitleSmall,
              { color: theme.subText, marginTop: 18 },
            ]}
          >
            History
          </Text>
          <Skeleton height={90} radius={12} style={{ marginTop: 12 }} />
          <Skeleton height={90} radius={12} style={{ marginTop: 12 }} />
        </View>
      </ScrollView>
    );
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: theme.background }}
      data={[]} // header-only
      keyExtractor={() => "dashboard-header"}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.primary}
        />
      }
      ListHeaderComponent={
        <>
          {/* Priority Pickups */}
          <SectionHeader
            title="Pickup"
            subtitle={
              upcomingPickups.length
                ? `${upcomingPickups.length} waiting`
                : "None"
            }
          />

          {upcomingPickups.length > 0 ? (
            <FlatList
              data={upcomingPickups}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 14, gap: 12 }}
              decelerationRate="fast"
              renderItem={({ item }) => (
                <Animated.View
                  style={{
                    opacity: itemOpacities[item.id] ?? 1,
                    transform: [{ translateY: itemTranslates[item.id] ?? 0 }],
                  }}
                >
                  <UpcomingCard
                    order={item}
                    theme={theme}
                    onPress={() =>
                      router.push(`/(rider)/order/pickup/${item.id}`)
                    }
                  />
                </Animated.View>
              )}
              keyExtractor={(i) => i.id}
            />
          ) : (
            <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
              <View
                style={{
                  backgroundColor: theme.card,
                  borderRadius: 12,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: theme.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "800",
                    color: theme.text, 
                    marginBottom: 6,
                  }}
                >
                  No immediate pickups
                </Text>

                <Text
                  style={{
                    fontSize: 13,
                    color: theme.subText, 
                    lineHeight: 18,
                  }}
                >
                  You’re all caught up.
                </Text>
              </View>
            </View>
          )}

          {/* Priority Deliveries */}
          <SectionHeader
            title="Delivery"
            subtitle={
              upcomingDeliveries.length
                ? `${upcomingDeliveries.length} waiting`
                : "None"
            }
          />

          {upcomingDeliveries.length > 0 ? (
            <FlatList
              data={upcomingDeliveries}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 14, gap: 12 }}
              decelerationRate="fast"
              renderItem={({ item }) => (
                <Animated.View
                  style={{
                    opacity: itemOpacities[item.id] ?? 1,
                    transform: [{ translateY: itemTranslates[item.id] ?? 0 }],
                  }}
                >
                  <DeliveryCard
                    order={item}
                    theme={theme}
                    onPress={() =>
                      router.push(`/(rider)/order/delivered/${item.id}`)
                    }
                    onOpenMap={() => {
                      if (item.lat != null && item.lng != null) {
                        const url = `https://www.google.com/maps?q=${item.lat},${item.lng}`;
                        Linking.openURL(url).catch((e) =>
                          console.warn("open map error", e)
                        );
                      }
                    }}
                  />
                </Animated.View>
              )}
              keyExtractor={(i) => i.id}
            />
          ) : (
                        <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
              <View
                style={{
                  backgroundColor: theme.card,
                  borderRadius: 12,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: theme.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "800",
                    color: theme.text, 
                    marginBottom: 6,
                  }}
                >
                  No immediate deliveries
                </Text>

                <Text
                  style={{
                    fontSize: 13,
                    color: theme.subText, 
                    lineHeight: 18,
                  }}
                >
                  You’re all caught up.
                </Text>
              </View>
            </View>
          )}

          {/* Top Row (wallet + rating) */}
          <Animated.View
            style={[
              styles.topRow,
              {
                opacity: kpi.opacity,
                transform: [{ translateY: kpi.translateY }],
              },
            ]}
          >
            {/* <View
              style={[
                styles.pill,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.pillTitle, { color: theme.subText }]}>
                WALLET
              </Text>
              <Text style={[styles.pillValue, { color: theme.text }]}>
                ₹ -- --
              </Text>
            </View> */}

            {/* <View style={[styles.ratingBox, { backgroundColor: theme.card }]}>
              <Ionicons name="star" size={12} color="#FACC15" />
              <Text style={[styles.ratingText, { color: theme.text }]}>--</Text>
            </View> */}
          </Animated.View>

          {/* KPI Cards */}
          <Animated.View
            style={[
              styles.kpiContainer,
              {
                opacity: kpi.opacity,
                transform: [{ translateY: kpi.translateY }],
              },
            ]}
          >
            <KpiCard title="TODAY ORDERS" value="-" theme={theme} />
            <KpiCard title="TOTAL ORDERS" value="--" theme={theme} />
          </Animated.View>

          <Animated.View
            style={[
              styles.kpiContainer,
              {
                opacity: kpi.opacity,
                transform: [{ translateY: kpi.translateY }],
              },
            ]}
          >
            <KpiCard title="KM TODAY" value="-- km" theme={theme} />
            <KpiCard title="TOTAL KM" value="-- km" theme={theme} />
          </Animated.View>
        </>
      }
      renderItem={null}
    />
  );
}

/* ---------- small components ---------- */

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: 16,
        marginTop: 18,
        marginBottom: 6,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <Text
        style={{
          fontSize: 16,
          fontWeight: "800",
          color: theme.text,
        }}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text style={{ fontSize: 13, color: "#94A3B8", fontWeight: "700" }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

/* ---------- Upcoming pickup card ---------- */
function UpcomingCard({
  order,
  theme,
  onPress,
}: {
  order: Order;
  theme: any;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={[
        styles.upcomingCard,
        {
          width: H_CARD,
          backgroundColor: theme.card,
          borderColor: theme.border,
        },
      ]}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: "900", fontSize: 16, color: theme.text }}>
            {order.name}
          </Text>

          <Text
            style={{ marginTop: 8, fontWeight: "700", color: theme.primary }}
          >
            {order.contact}
          </Text>

          <View style={{ flexDirection: "row", marginTop: 8 }}>
            <Ionicons
              name="location-outline"
              size={14}
              color={theme.subText}
              style={{ marginTop: 2, marginRight: 8 }}
            />
            <Text
              style={{ color: theme.subText, fontSize: 13, lineHeight: 18 }}
              numberOfLines={3}
            >
              {order.address}
            </Text>
          </View>
        </View>

        <View style={{ marginLeft: 12 }}>
          <View
            style={{
              backgroundColor: "#ECFDF5",
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
            }}
          >
            <Text style={{ color: "#166534", fontWeight: "800" }}>
              {order.status.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

/* ---------- Delivery card (with location button) ---------- */
function DeliveryCard({
  order,
  theme,
  onPress,
  onOpenMap,
}: {
  order: Order;
  theme: any;
  onPress: () => void;
  onOpenMap: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={[
        styles.upcomingCard,
        {
          width: H_CARD,
          backgroundColor: theme.card,
          borderColor: theme.border,
        },
      ]}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: "900", fontSize: 16, color: theme.text }}>
            {order.to || "Customer"}
          </Text>

          {order.contact ? (
            <Text
              style={{ marginTop: 8, fontWeight: "700", color: theme.primary }}
            >
              {order.contact}
            </Text>
          ) : null}

          <View style={{ flexDirection: "row", marginTop: 8 }}>
            <Ionicons
              name="location-outline"
              size={14}
              color={theme.subText}
              style={{ marginTop: 2, marginRight: 8 }}
            />
            <Text
              style={{ color: theme.subText, fontSize: 13, lineHeight: 18 }}
              numberOfLines={3}
            >
              {order.address}
            </Text>
          </View>
        </View>

        <View style={{ justifyContent: "center", alignItems: "center" }}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onOpenMap}
            style={{ padding: 8 }}
          >
            <Ionicons name="location" size={22} color={theme.primary} />
          </TouchableOpacity>

          <View
            style={{
              marginTop: 8,
              backgroundColor: "#F0FDF4",
              paddingHorizontal: 8,
              paddingVertical: 6,
              borderRadius: 999,
            }}
          >
            <Text style={{ color: "#166534", fontWeight: "800" }}>
              {order.status}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function EmptyMini({ label }: { label: string }) {
  return (
    <View style={{ paddingHorizontal: 16 }}>
      <View
        style={{
          padding: 12,
          borderRadius: 12,
          backgroundColor: "#0F172A10",
          marginBottom: 6,
        }}
      >
        <Text style={{ color: "#64748B" }}>{label}</Text>
      </View>
    </View>
  );
}

function KpiCard({
  title,
  value,
  theme,
}: {
  title: string;
  value: string;
  theme: any;
}) {
  return (
    <View
      style={[
        styles.kpiCard,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      <Text style={[styles.kpiTitle, { color: theme.subText }]}>{title}</Text>
      <Text style={[styles.kpiValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

/* ---------- styles ---------- */

const styles = StyleSheet.create({
  container: { flex: 1 },

  topRow: {
    marginTop: 20,
    paddingHorizontal: 16,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  pill: {
    padding: 12,
    borderRadius: 12,
    width: CARD_WIDTH * 0.62,
    borderWidth: 1,
  },
  pillTitle: { fontSize: 12, fontWeight: "700", opacity: 0.9 },
  pillValue: { fontSize: 18, fontWeight: "900", marginTop: 8 },

  ratingBox: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
  },
  ratingText: { marginLeft: 6, fontWeight: "800" },

  kpiContainer: {
    paddingHorizontal: 16,
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  kpiCard: {
    width: "48%",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  kpiTitle: { fontSize: 11, fontWeight: "700", marginBottom: 6 },
  kpiValue: { fontSize: 20, fontWeight: "900" },

  upcomingCard: {
    borderRadius: 14,
    padding: 16,
    marginRight: 12,
    borderWidth: 1,
    minHeight: H_CARD * 0.45,
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },

  pillMini: {
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pillMiniOutline: {
    borderWidth: 1,
    borderColor: "#10B981",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 999,
  },

  sectionHeader: {
    paddingHorizontal: 14,
    marginTop: 8,
    marginBottom: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: { fontSize: 16, fontWeight: "800" },
  sectionTitleSmall: { fontSize: 14, fontWeight: "800" },
  viewAll: { fontSize: 13, fontWeight: "700" },

  orderCard: {
    marginHorizontal: 16,
    padding: 8,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  orderLeft: { width: 48, alignItems: "center" },
  orderIconWrap: {
    width: 40,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  orderCenter: { flex: 1, paddingHorizontal: 8 },

  orderId: { fontWeight: "800", marginBottom: 4 },
  orderTime: { fontSize: 12 },
  orderMeta: { fontSize: 12, marginTop: 4 },

  orderRight: { alignItems: "flex-end", width: 110 },
  orderPrice: { fontWeight: "900", fontSize: 16, marginBottom: 6 },

  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusText: { fontWeight: "800", fontSize: 12 },
});
