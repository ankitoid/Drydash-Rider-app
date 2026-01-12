import CaptureImageModal from "@/components/Modals/CaptureImageModal";
import ConfirmModal from "@/components/Modals/ConfirmModal";
import { useAuth } from "@/context/useAuth";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import moment from "moment";
import React, { useEffect, useState } from "react";
import {
  Linking,
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

  const { theme, isDark } = useTheme();
  const { user } = useAuth();

  const API_URL = "https://api.drydash.in/api/v1/auth";
  const base_url = "https://api.drydash.in/api/v1"
  const wattiUri = 'https://live-server-101289.wati.io/api/v1'
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1bmlxdWVfbmFtZSI6ImF5dXNoc2luZ2g4NDIwMThAZ21haWwuY29tIiwibmFtZWlkIjoiYXl1c2hzaW5naDg0MjAxOEBnbWFpbC5jb20iLCJlbWFpbCI6ImF5dXNoc2luZ2g4NDIwMThAZ21haWwuY29tIiwiYXV0aF90aW1lIjoiMTIvMDgvMjAyNSAwNzoyMzo1MyIsInRlbmFudF9pZCI6IjEwMTI4OSIsImRiX25hbWUiOiJtdC1wcm9kLVRlbmFudHMiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOlsiVEVNUExBVEVfTUFOQUdFUiIsIkRFVkVMT1BFUiIsIkFVVE9NQVRJT05fTUFOQUdFUiJdLCJleHAiOjI1MzQwMjMwMDgwMCwiaXNzIjoiQ2xhcmVfQUkiLCJhdWQiOiJDbGFyZV9BSSJ9.NpVe1fi-RXRuNgCAGzFQLZT6dE7Y-rvlx1SYxLKZ_m4'
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
    if(deliveryImage)
    {
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
  await updateStatus();
  await sendWhatsAppTemplateDelivered();
  getOrderDetails();

  } catch (error) {
    console.log("Image upload error:", error);
  }
}


const updateStatus = async () => {
  try {
    const res = await fetch(
      `${API_URL}/updateOrderStatus/${orderId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ status: "delivered" }),
        headers: {
          "Content-Type": "application/json",
          "x-client-type": "mobile",
        },
      }
    );

    const json = await res.json();
    console.log("Update status response:", json);

    if (!res.ok) {
      throw new Error(json.message || "Failed to update order status");
    }
  } catch (error) {
    console.log("Order status update error:", error);
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

const sendWhatsAppTemplateRescheduleNoCall = async () => {
  try {
    const phone = normalizePhoneForWhatsApp(order?.contactNo);
    if (!phone) return;

    const templatePayload = {
      template_name:
        "delivery_rescheduled__unable_to_reach_customer_",
      broadcast_name: `delivery_rescheduled__unable_to_reach_customer_${orderId}_${Date.now()}`,
      parameters: [
        { name: "name", value: order?.customerName },
      ],
    };

    const sendRes = await fetch(
      `${API_URL}/sendTemplateMessage?whatsappNumber=${phone}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(templatePayload),
      }
    );

    if (sendRes.ok) {
      // toast.success("WhatsApp (unable to reach) sent.");
    }
  } catch (error) {
    console.error(
      "Error sending reschedule no-call template:",
      error
    );
  }
};


//t3
const sendWhatsAppTemplateRescheduleWithCall = async () => {
  try {

    const rescheduleDate = moment(order?.rescheduledDate).format(
      "MMMM Do YYYY"
    );

    const phone = normalizePhoneForWhatsApp(order?.contactNo);
    if (!phone) return;

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
      `${API_URL}/sendTemplateMessage?whatsappNumber=${phone}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(templatePayload),
      }
    );

    if (sendRes.ok) {
     
    }
  } catch (error) {
    console.error(
      "Error sending reschedule with-call template:",
      error
    );
  }
};



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
    setDeliveryImage('uri');
    setShowCamera(false);
    setShowConfirm(true);
  }

  const confirmDelivered = async () => {
    try {
      setDelivering(true);
      setShowConfirm(false);

      console.log("Delivered with image:", deliveryImage);
      await uploadImage();


      /**
       * Example:
       * const formData = new FormData();
       * formData.append("image", {
       *   uri: deliveryImage,
       *   name: "delivery.jpg",
       *   type: "image/jpeg",
       * });
       *
       * await fetch(`${API_URL}/markDelivered/${order._id}`, {
       *   method: "POST",
       *   body: formData,
       * });
       */

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
        {/* <View
          style={[
            styles.statusBadge,
            { backgroundColor: isDark ? successGreen + "22" : "#DCFCE7" },
          ]}
        >
          <Ionicons name="checkmark-circle" size={18} color={successGreen} />
          <Text style={[styles.statusText, { color: successGreen }]}>
            Delivered
          </Text>
        </View> */}

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
           style={[
    styles.actionBtn,
    styles.rescheduleBtn,
    { opacity: 0.5 }, // visual disabled effect
  ]}
  activeOpacity={1}
  disabled={true}
            onPress={() => {
              console.log("Rescheduled pressed");
              // TODO: open reschedule modal / API
            }}
          >
            <Ionicons name="calendar-outline" size={20} color="#fff" />
            <Text style={styles.actionBtnText}>Rescheduled</Text>
          </TouchableOpacity>
        </View>
      </View>
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
    </ScrollView>
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
