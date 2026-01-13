import CaptureImageModal from "@/components/Modals/CaptureImageModal";
import ConfirmModal from "@/components/Modals/ConfirmModal";
import { useAuth } from "@/context/useAuth";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import { router, useLocalSearchParams } from "expo-router";
import moment from "moment";
import React, { useEffect, useState } from "react";
import {
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../../../../context/ThemeContext";
 
/* ===================== INTERFACES ===================== */
 
interface StatusHistory {
  intransit: string | null;
  processing: string | null;
  readyForDelivery: string | null;
  deliveryriderassigned: string | null;
  delivered: string | null;
  cancelled: string | null;
}
 
interface OrderItem {
  _id: string;
  heading: string;
  subHeading: string;
  quantity: number;
  price: number;
  newQtyPrice: number;
}
 
interface OrderDetails {
  _id: string;
  order_id: string;
  customerName: string;
  contactNo: string;
  address: string;
  items: OrderItem[];
  price: number;
  status: string;
  statusHistory: StatusHistory;
  createdAt: string;
  updatedAt: string;
  riderName: string;
  riderDate: string;
  rescheduledDate?: string | null;
}
 
/* ===================== COMPONENT ===================== */
 
export default function DeliveredOrderDetails() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [delivering, setDelivering] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [deliveryImage, setDeliveryImage] = useState<string | null>(null);
 
  const [rescheduleVisible, setRescheduleVisible] = useState(false);
  const [orderToReschedule, setOrderToReschedule] =
    useState<OrderDetails | null>(null);
  const [rescheduling, setRescheduling] = useState(false);
 
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
 
  const API_URL = "https://api.drydash.in/api/v1/auth";
  const base_url = "https://api.drydash.in/api/v1";
  const wattiUri = "https://live-server-101289.wati.io/api/v1";
  const token =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1bmlxdWVfbmFtZSI6ImF5dXNoc2luZ2g4NDIwMThAZ21haWwuY29tIiwibmFtZWlkIjoiYXl1c2hzaW5naDg0MjAxOEBnbWFpbC5jb20iLCJlbWFpbCI6ImF5dXNoc2luZ2g4NDIwMThAZ21haWwuY29tIiwiYXV0aF90aW1lIjoiMTIvMDgvMjAyNSAwNzoyMzo1MyIsInRlbmFudF9pZCI6IjEwMTI4OSIsImRiX25hbWUiOiJtdC1wcm9kLVRlbmFudHMiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOlsiVEVNUExBVEVfTUFOQUdFUiIsIkRFVkVMT1BFUiIsIkFVVE9NQVRJT05fTUFOQUdFUiJdLCJleHAiOjI1MzQwMjMwMDgwMCwiaXNzIjoiQ2xhcmVfQUkiLCJhdWQiOiJDbGFyZV9BSSJ9.NpVe1fi-RXRuNgCAGzFQLZT6dE7Y-rvlx1SYxLKZ_m4";
  const successGreen = "#22C55E";
 
  /* ===================== API ===================== */
 
  const getOrderDetails = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/getOrderById/${orderId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-client-type": "mobile",
        },
      });
 
      const json = await res.json();
 
      console.log("this is the res json detail page==>>", json);
 
      if (!res.ok) {
        throw new Error(json.message || "Failed to fetch order");
      }
 
      setOrder(json);
      setLoading(false);
    } catch (error) {
      console.log("Order fetch error:", error);
    } finally {
      setLoading(false);
    }
  };
 
  const uploadImage = async () => {
    try {
      if (deliveryImage) {
        const response = await fetch(deliveryImage);
        const blob = await response.blob(); // ✅ binary form
 
        const formData = new FormData();
        formData.append("image", blob);
 
        const res = await fetch(
          `${base_url}/rider/uploadDeliverImage/${orderId}`,
          {
            method: "POST",
            body: formData,
            headers: {
              "x-client-type": "mobile",
            },
          }
        );
        const json = await res.json();
        console.log("Upload image response:", json);
 
        if (!res.ok) {
          throw new Error(json.message || "Failed to upload image");
        }
      }
      //updating status
      await updateStatusTo(orderId, "delivered");
      await sendWhatsAppTemplateDelivered();
      getOrderDetails();
    } catch (error) {
      console.log("Image upload error:", error);
    }
  };
 
  const updateStatusTo = async (id: string | undefined, status: string) => {
    if (!id) return;
    try {
      const res = await fetch(`${API_URL}/updateOrderStatus/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
        headers: {
          "Content-Type": "application/json",
          "x-client-type": "mobile",
        },
      });
 
      const json = await res.json();
      console.log("Update status response:", json);
 
      if (!res.ok) {
        throw new Error(json.message || "Failed to update order status");
      }
    } catch (error) {
      console.log("Order status update error:", error);
      throw error;
    }
  };
 
  //helper
 
  const normalizePhoneForWhatsApp = (raw) => {
    if (!raw) return null;
    let digits = String(raw).replace(/\D/g, "");
    if (digits.length === 10) digits = "91" + digits;
    if (digits.length < 11) return null;
    return digits;
  };
 
  //template
 
  //t1
 
  const sendWhatsAppTemplateDelivered = async () => {
    try {
      const phone = normalizePhoneForWhatsApp(order?.contactNo);
      if (!phone) return false;
 
      const templatePayload = {
        template_name: "delivery_success",
        broadcast_name: `delivery_success_${orderId}_${Date.now()}`,
        parameters: [
          { name: "name", value: order?.customerName || "Customer" },
        ],
      };
 
      const sendRes = await fetch(
        `${wattiUri}/sendTemplateMessage?whatsappNumber=${phone}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(templatePayload),
        }
      );
 
      return sendRes.ok;
    } catch (err) {
      console.error("Error sending delivered template:", err);
      return false;
    }
  };
 
  //t2
 
  const sendWhatsAppTemplateRescheduleNoCall = async (
    orderIdParam?: string
  ) => {
    try {
      const phone = normalizePhoneForWhatsApp(order?.contactNo);
      if (!phone) return false;
 
      const templatePayload = {
        template_name: "delivery_rescheduled__unable_to_reach_customer_",
        broadcast_name: `delivery_rescheduled__unable_to_reach_customer_${orderId}_${Date.now()}`,
        parameters: [{ name: "name", value: order?.customerName }],
      };
 
      const sendRes = await fetch(
        `${wattiUri}/sendTemplateMessage?whatsappNumber=${phone}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(templatePayload),
        }
      );
 
      return sendRes.ok;
    } catch (err) {
      console.error("Error sending reschedule no-call template:", err);
      return false;
    }
  };
 
  //t3
  const sendWhatsAppTemplateRescheduleWithCall = async (
    orderIdParam?: string,
    chosenDate?: Date
  ) => {
    try {
      const rescheduleDate = chosenDate
        ? moment(chosenDate).format("MMMM Do YYYY")
        : moment(order?.rescheduledDate).format("MMMM Do YYYY");
 
      const phone = normalizePhoneForWhatsApp(order?.contactNo);
      if (!phone) return false;
 
      const templatePayload = {
        template_name: "delivery__rescheduling_notification",
        broadcast_name: `delivery__rescheduling_notification_${orderId}_${Date.now()}`,
        parameters: [
          { name: "name", value: order?.customerName },
          {
            name: "delivery_rescheduled_date",
            value: rescheduleDate,
          },
        ],
      };
 
      const sendRes = await fetch(
        `${wattiUri}/sendTemplateMessage?whatsappNumber=${phone}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(templatePayload),
        }
      );
 
      return sendRes.ok;
    } catch (error) {
      console.error("Error sending reschedule with-call template:", error);
      return false;
    }
  };
 
  const openReschedule = (ord: OrderDetails) => {
    setOrderToReschedule(ord);
    setRescheduleVisible(true);
  };
 
  const rescheduleOrder = async (
    orderIdParam: string,
    newDate: Date | null,
    answered: boolean
  ) => {
    setRescheduling(true);
    try {
      const dateToSend = newDate ? newDate.toISOString() : null;
 
      const res = await fetch(
        `${base_url}/rider/rescheduleorder/${orderIdParam}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ newDate: dateToSend }),
        }
      );
 
      const json = await res.json();
      console.log("rescheduleApiResp", json);
 
      if (!res.ok) {
        throw new Error(json.message || "Failed to reschedule");
      }
 
      await updateStatusTo(orderIdParam, "ready for delivery");
 
      await getOrderDetails();
 
      if (answered) {
        await sendWhatsAppTemplateRescheduleWithCall(
          orderIdParam,
          newDate ?? undefined
        );
      } else {
        await sendWhatsAppTemplateRescheduleNoCall(orderIdParam);
      }
    } catch (err) {
      console.error("Error rescheduling (RN):", err);
      // you can show toast here if you have one
    } finally {
      setRescheduleVisible(false);
      setOrderToReschedule(null);
      setRescheduling(false);
    }
  };
 
  /* ===================== LIFECYCLE ===================== */
 
  useEffect(() => {
    getOrderDetails();
  }, []);
 
  const onImageCaptured = (uri: string) => {
    setDeliveryImage(uri);
    setShowCamera(false);
    setShowConfirm(true);
  };
 
  /* ---------- SKELETON ---------- */
 
  function SkeletonHeader() {
    return (
      <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
        <View style={styles.skeletonTitle} />
        <View style={styles.skeletonSub} />
      </View>
    );
  }
 
  function SkeletonCard() {
    return <View style={styles.skeletonCard} />;
  }
 
  /* ===================== LOADING ===================== */
 
  if (loading || !order) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={{ padding: 16 }}
      >
        <SkeletonHeader />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </ScrollView>
    );
  }
 
  const onDeliveredPress = () => {
    setShowCamera(true);
  };
 
  const skipCapture = () => {
    setDeliveryImage("uri");
    setShowCamera(false);
    setShowConfirm(true);
  };
 
  const confirmDelivered = async () => {
    try {
      setDelivering(true);
      setShowConfirm(false);
 
      console.log("Delivered with image:", deliveryImage);
      await uploadImage();
 
      router.back();
    } catch (err) {
      console.error(err);
    } finally {
      setDelivering(false);
    }
  };
 
  /* ===================== UI ===================== */
 
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{ paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      {/* HEADER */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: isDark ? theme.card : theme.primary,
            borderBottomColor: theme.border,
          },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons
            name="arrow-back"
            size={22}
            color={isDark ? theme.text : "#fff"}
          />
        </TouchableOpacity>
 
        <Text
          style={[styles.headerTitle, { color: isDark ? theme.text : "#fff" }]}
        >
          Dry Dash
        </Text>
 
        <View style={[styles.avatar, { backgroundColor: theme.primarySoft }]}>
          <Text style={[styles.avatarText, { color: theme.primary }]}>
            {user?.name?.slice(0, 1).toUpperCase()}
          </Text>
        </View>
      </View>
 
      {/* STATUS */}
      <View style={styles.statusWrap}>
        <Text style={[styles.orderId, { color: theme.text }]}>
          {order.order_id}
        </Text>
      </View>
 
      {/* DELIVERY DETAILS */}
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>
          Delivery Details
        </Text>
 
        <DetailRow
          icon="person-outline"
          label="Name"
          value={order.customerName}
          theme={theme}
        />
 
        <DetailRow
          icon="call-outline"
          label="Contact"
          value={order.contactNo}
          theme={theme}
          onPress={() => Linking.openURL(`tel:${order.contactNo}`)}
          isLink
        />
 
        <DetailRow
          icon="location-outline"
          label="Address"
          value={order.address}
          theme={theme}
        />
 
        <DetailRow
          icon="time-outline"
          label="Time"
          value={
            order?.createdAt ? moment(order.createdAt).format("hh:mm A") : "—"
          }
          theme={theme}
        />
      </View>
 
      {/* ITEMS */}
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>Items</Text>
 
        {order.items.map((item) => (
          <ItemRow
            key={item._id}
            label={`${item.heading}  x  ${item.quantity}`}
            price={`₹${item.newQtyPrice}`}
            theme={theme}
          />
        ))}
      </View>
 
      {/* PAYMENT */}
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>
          Payment Summary
        </Text>
 
        <SummaryRow label="Subtotal" price={`₹${order.price}`} theme={theme} />
 
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
 
        <SummaryRow
          label="Total Paid"
          price={`₹${order.price}`}
          bold
          theme={theme}
        />
      </View>
 
      {/* ACTION BUTTONS */}
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>
          Delivery Action's
        </Text>
 
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.deliveredBtn]}
            activeOpacity={0.8}
            onPress={onDeliveredPress}
            disabled={delivering}
          >
            <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
            <Text style={styles.actionBtnText}>
              {delivering ? "Processing..." : "Delivered"}
            </Text>
          </TouchableOpacity>
 
          <TouchableOpacity
            style={[styles.actionBtn, styles.rescheduleBtn]}
            activeOpacity={0.8}
            onPress={() => openReschedule(order)}
          >
            <Ionicons name="calendar-outline" size={20} color="#fff" />
            <Text style={styles.actionBtnText}>Rescheduled</Text>
          </TouchableOpacity>
        </View>
      </View>
 
      {/* Modals */}
      <CaptureImageModal
        visible={showCamera}
        onCancel={() => setShowCamera(false)}
        onImageCaptured={onImageCaptured}
        skipCapture={skipCapture}
      />
 
      <ConfirmModal
        visible={showConfirm}
        title="Mark as Delivered?"
        message="Are you sure you want to mark this delivery as delivered?"
        confirmText="Yes, Delivered"
        cancelText="Cancel"
        onConfirm={confirmDelivered}
        onCancel={() => setShowConfirm(false)}
      />
 
      <RescheduleModalRN
        visible={rescheduleVisible}
        onClose={() => {
          setRescheduleVisible(false);
          setOrderToReschedule(null);
        }}
        order={orderToReschedule}
        onConfirm={async (chosenDate, answered) => {
          if (!orderToReschedule) return;
          await rescheduleOrder(orderToReschedule._id, chosenDate, answered);
        }}
        loading={rescheduling}
      />
    </ScrollView>
  );
}
 
/* ===================== RESCHEDULE MODAL (RN) ===================== */
 
function RescheduleModalRN({
  visible,
  onClose,
  order,
  onConfirm,
  loading,
}: {
  visible: boolean;
  onClose: () => void;
  order: OrderDetails | null;
  onConfirm: (date: Date | null, answered: boolean) => Promise<void>;
  loading?: boolean;
}) {
  const [step, setStep] = useState<"CHOICE" | "ANSWERED" | "NO_ANSWER">(
    "CHOICE"
  );
  const [date, setDate] = useState<Date>(new Date());
  const [showIOSPicker, setShowIOSPicker] = useState(false);
 
  /* Reset modal state when opened */
  useEffect(() => {
    if (visible) {
      setStep("CHOICE");
      setDate(new Date());
      setShowIOSPicker(false);
    }
  }, [visible]);
 
  /* Android picker */
  const openAndroidPicker = () => {
    DateTimePickerAndroid.open({
      value: date,
      mode: "datetime",
      minimumDate: new Date(),
      onChange: (_, selectedDate) => {
        if (selectedDate) setDate(selectedDate);
      },
    });
  };
 
  if (!visible) return null;
 
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={modalStyles.backdrop}>
        <View style={modalStyles.sheet}>
          <Text style={modalStyles.title}>Reschedule Delivery</Text>
 
          {/* ================= STEP 1 ================= */}
          {step === "CHOICE" && (
            <>
              <Text style={modalStyles.sub}>
                Did the customer answer your call?
              </Text>
 
              {/* Answered + Not Answered in SAME ROW */}
              <View style={modalStyles.actionsRow}>
                <TouchableOpacity
                  style={[modalStyles.action, { backgroundColor: "#22C55E" }]}
                  onPress={() => setStep("ANSWERED")}
                >
                  <Text style={modalStyles.actionTextWhite}>Answered</Text>
                </TouchableOpacity>
 
                <TouchableOpacity
                  style={[modalStyles.action, { backgroundColor: "#FACC15" }]} // Yellow
                  onPress={() => setStep("NO_ANSWER")}
                >
                  <Text style={modalStyles.actionTextDark}>Not Answered</Text>
                </TouchableOpacity>
              </View>
 
              {/* Cancel Button */}
             <TouchableOpacity
  onPress={onClose}
  style={modalStyles.cancelBtn}
  activeOpacity={0.8}
>
  <Text style={modalStyles.cancelTextDark}>Cancel</Text>
</TouchableOpacity>
 
            </>
          )}
 
          {/* ================= STEP 2A ================= */}
          {step === "ANSWERED" && (
            <>
              <Text style={modalStyles.sub}>
                Select a new delivery date & time
              </Text>
 
              <TouchableOpacity
                style={modalStyles.dateBtn}
                onPress={() =>
                  Platform.OS === "android"
                    ? openAndroidPicker()
                    : setShowIOSPicker(true)
                }
              >
                <Text style={modalStyles.dateText}>
                  {moment(date).format("dddd, MMM D, YYYY - hh:mm A")}
                </Text>
              </TouchableOpacity>
 
              {Platform.OS === "ios" && showIOSPicker && (
                <DateTimePicker
                  value={date}
                  mode="datetime"
                  display="inline"
                  minimumDate={new Date()}
                  onChange={(_, d) => d && setDate(d)}
                />
              )}
 
              <View style={modalStyles.actionsRow}>
                <TouchableOpacity
                  style={[modalStyles.action, { backgroundColor: "#22C55E" }]}
                  disabled={loading}
                  onPress={() => onConfirm(date, true)}
                >
                  <Text style={modalStyles.actionText}>
                    {loading ? "Please wait..." : "Confirm"}
                  </Text>
                </TouchableOpacity>
 
                <TouchableOpacity
                  style={[modalStyles.action, { backgroundColor: "#E5E7EB" }]}
                  onPress={() => setStep("CHOICE")}
                >
                  <Text style={[modalStyles.actionText, { color: "#000" }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
 
          {/* ================= STEP 2B ================= */}
          {step === "NO_ANSWER" && (
            <>
              <Text style={modalStyles.sub}>
                Customer did not answer. Delivery will be rescheduled to:
              </Text>
 
              <Text style={modalStyles.dateText}>
                {moment().add(1, "day").format("dddd, MMM D, YYYY")}
              </Text>
 
              <View style={modalStyles.actionsRow}>
                <TouchableOpacity
                  style={[modalStyles.action, { backgroundColor: "#F59E0B" }]}
                  disabled={loading}
                  onPress={() =>
                    onConfirm(moment().add(1, "day").toDate(), false)
                  }
                >
                  <Text style={modalStyles.actionText}>
                    {loading ? "Please wait..." : "Confirm"}
                  </Text>
                </TouchableOpacity>
 
                <TouchableOpacity
                  style={[modalStyles.action, { backgroundColor: "#E5E7EB" }]}
                  onPress={() => setStep("CHOICE")}
                >
                  <Text style={[modalStyles.actionText, { color: "#000" }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}
 
/* ===================== SMALL COMPONENTS ===================== */
 
function DetailRow({ icon, label, value, theme, onPress, isLink }: any) {
  return (
    <TouchableOpacity
      disabled={!onPress}
      onPress={onPress}
      activeOpacity={0.7}
      style={styles.detailRow}
    >
      <Ionicons name={icon} size={18} color={theme.primary} />
 
      <View style={styles.detailContent}>
        <Text style={[styles.detailLabel, { color: theme.subText }]}>
          {label}
        </Text>
 
        <Text
          style={[
            styles.detailValue,
            { color: isLink ? theme.primary : theme.text },
          ]}
          numberOfLines={0} // ✅ allow unlimited lines
        >
          {value}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
 
function ItemRow({ label, price, theme }: any) {
  return (
    <View style={styles.itemRow}>
      <Text style={[styles.itemLabel, { color: theme.text }]}>{label}</Text>
      <Text style={[styles.itemPrice, { color: theme.text }]}>{price}</Text>
    </View>
  );
}
 
function SummaryRow({ label, price, bold, theme }: any) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, bold && { fontWeight: "900" }]}>
        {label}
      </Text>
      <Text style={[styles.summaryPrice, bold && { fontWeight: "900" }]}>
        {price}
      </Text>
    </View>
  );
}
 
function ConfirmRow({ icon, text, theme }: any) {
  return (
    <View style={styles.confirmRow}>
      <Ionicons name={icon} size={20} color={theme.primary} />
      <Text style={[styles.confirmText, { color: theme.text }]}>{text}</Text>
    </View>
  );
}
 
/* ===================== STYLES ===================== */
 
const styles = StyleSheet.create({
  header: {
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
  },
  headerTitle: { fontWeight: "900", fontSize: 16 },
 
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontWeight: "800" },
 
  statusWrap: { alignItems: "center", marginVertical: 14 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusText: { fontWeight: "900", fontSize: 13 },
  orderId: { fontSize: 20, fontWeight: "900", marginTop: 6 },
 
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 18,
  },
  cardTitle: { fontSize: 16, fontWeight: "900", marginBottom: 12 },
 
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
  },
 
  detailContent: {
    flex: 1,
    marginLeft: 10,
  },
 
  detailLabel: {
    fontSize: 12,
  },
 
  detailValue: {
    fontSize: 14,
    fontWeight: "700",
    flexWrap: "wrap",
  },
 
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  itemLabel: { fontSize: 14, fontWeight: "700" },
  itemPrice: { fontSize: 14, fontWeight: "800" },
 
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  summaryLabel: { fontSize: 14 },
  summaryPrice: { fontSize: 14, fontWeight: "800" },
 
  divider: { height: 1, marginVertical: 10 },
 
  confirmRow: { flexDirection: "row", gap: 10 },
  confirmText: { fontWeight: "700", fontSize: 14 },
 
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
 
  actionBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
 
  deliveredBtn: {
    backgroundColor: "#22C55E", // green
  },
 
  rescheduleBtn: {
    backgroundColor: "#F59E0B", // amber
  },
 
  actionBtnText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 14,
  },
  skeletonTitle: {
    width: 160,
    height: 22,
    borderRadius: 8,
    backgroundColor: "#CBD5E1",
    opacity: 0.3,
    marginBottom: 8,
  },
  skeletonSub: {
    width: 220,
    height: 14,
    borderRadius: 6,
    backgroundColor: "#CBD5E1",
    opacity: 0.25,
  },
  skeletonCard: {
    height: 86,
    borderRadius: 16,
    backgroundColor: "#CBD5E1",
    opacity: 0.3,
    marginHorizontal: 16,
    marginBottom: 12,
  },
});
 
const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "#00000066",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 6,
  },
  sub: {
    fontSize: 13,
    color: "#374151",
    marginBottom: 12,
  },
  dateBtn: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
  },
  dateText: {
    fontSize: 14,
    fontWeight: "700",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  action: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  actionText: {
    color: "#fff",
    fontWeight: "800",
  },
  cancel: {
    marginTop: 12,
    alignItems: "center",
  },
  cancelText: {
    color: "#374151",
    fontWeight: "700",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
 
  action: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
 
  actionTextWhite: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 14,
  },
 
  actionTextDark: {
    color: "#000",
    fontWeight: "900",
    fontSize: 14,
  },
  cancelBtn: {
  marginTop: 12,
  paddingVertical: 14,
  borderRadius: 12,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "#E5E7EB", // gray
},
 
cancelTextDark: {
  color: "#374151",
  fontWeight: "900",
  fontSize: 14,
},
 
});