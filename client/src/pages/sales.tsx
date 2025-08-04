import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Search,
  Eye,
  FileText,
  QrCode,
  Printer,
  Download,
  Edit,
} from "lucide-react";
import InvoiceForm from "@/components/forms/invoice-form";
import InvoiceViewer from "@/components/invoice/invoice-viewer";
import BarcodeScanner from "@/components/barcode/barcode-scanner";
import type { Transaction, Product, TransactionItem } from "@shared/schema";

export default function Sales() {
  const [search, setSearch] = useState("");
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);
  const [showInvoice, setShowInvoice] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const { toast } = useToast();

  // Listen for transaction update messages from edit windows
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data.type === "UPDATE_TRANSACTION") {
        try {
          console.log(
            "Updating transaction:",
            event.data.transactionId,
            event.data.data,
            "Items:",
            event.data.items,
          );

          // Update transaction
          const response = await fetch(
            `/api/transactions/${event.data.transactionId}`,
            {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(event.data.data),
            },
          );

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Failed to update transaction");
          }

          const updatedTransaction = await response.json();
          console.log("Transaction updated successfully:", updatedTransaction);

          // Update items if provided
          if (event.data.items && event.data.items.length > 0) {
            console.log("Updating transaction items...");
            
            const itemsResponse = await fetch(
              `/api/transactions/${event.data.transactionId}/items`,
              {
                method: "PUT",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ items: event.data.items }),
              },
            );

            if (!itemsResponse.ok) {
              const itemsErrorData = await itemsResponse.json();
              throw new Error(itemsErrorData.error || "Failed to update items");
            }

            console.log("Items updated successfully");
          }

          // Refresh the transactions data
          queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
          queryClient.invalidateQueries({
            queryKey: ["/api/dashboard/metrics"],
          });

          toast({
            title: "تم التحديث",
            description: "تم تحديث بيانات المعاملة والأصناف بنجاح",
          });
        } catch (error) {
          console.error("Error updating transaction:", error);
          toast({
            title: "خطأ",
            description: `فشل في تحديث المعاملة: ${error instanceof Error ? error.message : "خطأ غير معروف"}`,
            variant: "destructive",
          });
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [toast]);

  const { data: transactions = [], isLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions", search],
    retry: false,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-600";
      case "pending":
        return "bg-yellow-100 text-yellow-600";
      case "cancelled":
        return "bg-red-100 text-red-600";
      default:
        return "bg-slate-100 text-slate-600";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "completed":
        return "مكتملة";
      case "pending":
        return "معلقة";
      case "cancelled":
        return "ملغية";
      default:
        return status;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title="إدارة المبيعات"
          subtitle="إدارة الفواتير والمعاملات المالية"
        />
        <main className="flex-1 overflow-auto p-6">
          {/* Header Actions */}
          <div className="flex items-center justify-between mb-6">
            <div className="relative max-w-md">
              <Search className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                placeholder="البحث في المعاملات..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowBarcodeScanner(true)}
              >
                <QrCode className="h-4 w-4 ml-2" />
                مسح باركود
              </Button>
              <Button
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => setShowInvoiceForm(true)}
              >
                <Plus className="h-4 w-4 ml-2" />
                فاتورة جديدة
              </Button>
            </div>
          </div>

          {/* Transactions Table */}
          <Card>
            <CardHeader>
              <CardTitle>المعاملات الأخيرة</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-4 bg-slate-200 rounded w-full mb-2"></div>
                    </div>
                  ))}
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">
                    لا توجد معاملات
                  </h3>
                  <p className="text-slate-600 mb-4">
                    {search
                      ? "لم يتم العثور على معاملات مطابقة للبحث"
                      : "ابدأ بإنشاء فاتورة جديدة"}
                  </p>
                  <Button
                    className="bg-blue-600 hover:bg-blue-700"
                    onClick={() => setShowInvoiceForm(true)}
                  >
                    <Plus className="h-4 w-4 ml-2" />
                    فاتورة جديدة
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="text-right px-6 py-4 text-sm font-medium text-slate-600">
                          رقم المعاملة
                        </th>
                        <th className="text-right px-6 py-4 text-sm font-medium text-slate-600">
                          العميل
                        </th>
                        <th className="text-right px-6 py-4 text-sm font-medium text-slate-600">
                          المبلغ
                        </th>
                        <th className="text-right px-6 py-4 text-sm font-medium text-slate-600">
                          نوع الدفع
                        </th>
                        <th className="text-right px-6 py-4 text-sm font-medium text-slate-600">
                          الحالة
                        </th>
                        <th className="text-right px-6 py-4 text-sm font-medium text-slate-600">
                          التاريخ
                        </th>
                        <th className="text-right px-6 py-4 text-sm font-medium text-slate-600">
                          الإجراءات
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {transactions.map((transaction: Transaction) => (
                        <tr key={transaction.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4 text-sm font-medium text-slate-800">
                            <div className="flex items-center gap-2">
                              {(transaction as any).transactionType === "debt_collection" && (
                                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-xs">
                                  سداد دين
                                </Badge>
                              )}
                              {transaction.transactionNumber}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">
                            {transaction.customerName || "عميل غير محدد"}
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-slate-800">
                            <div className="flex items-center gap-1">
                              {(transaction as any).transactionType === "debt_collection" && (
                                <span className="text-green-600 font-bold">-</span>
                              )}
                              {Math.abs(Number(transaction.total || "0")).toFixed(2)}{" "}
                              {transaction.currency === "USD" ? "$" : "₺"}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {(transaction as any).transactionType === "debt_collection" ? (
                              <Badge className="bg-green-100 text-green-700">
                                سداد دين
                              </Badge>
                            ) : (
                              <Badge
                                variant={
                                  transaction.paymentType === "credit"
                                    ? "destructive"
                                    : "secondary"
                                }
                              >
                                {transaction.paymentType === "credit"
                                  ? "دين"
                                  : "نقد"}
                              </Badge>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <Badge
                              className={getStatusColor(
                                transaction.status || "pending",
                              )}
                            >
                              {getStatusText(transaction.status || "pending")}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">
                            {transaction.createdAt
                              ? new Date(
                                  transaction.createdAt,
                                ).toLocaleDateString("ar-SA")
                              : "تاريخ غير محدد"}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={() => {
                                  setSelectedTransaction(transaction);
                                  setShowInvoice(true);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-blue-600 hover:text-blue-800"
                                title="طباعة الفاتورة"
                                onClick={async () => {
                                  try {
                                    // Fetch transaction items from API
                                    const response = await fetch(
                                      `/api/transactions/${transaction.id}/items`,
                                    );
                                    const items = response.ok
                                      ? await response.json()
                                      : [];

                                    const printWindow = window.open(
                                      "",
                                      "_blank",
                                    );
                                    if (printWindow) {
                                      printWindow.document.write(`
                                        <html>
                                          <head>
                                            <title>طباعة فاتورة ${transaction.transactionNumber}</title>
                                            <meta charset="UTF-8">
                                            <style>
                                              @media print {
                                                @page {
                                                  size: A4;
                                                  margin: 1cm;
                                                }
                                              }
                                              body {
                                                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                                                direction: rtl;
                                                margin: 0;
                                                padding: 20px;
                                                line-height: 1.6;
                                                color: #333;
                                              }
                                              .invoice-header {
                                                text-align: center;
                                                border-bottom: 3px solid #2563eb;
                                                padding-bottom: 20px;
                                                margin-bottom: 30px;
                                              }
                                              .invoice-title {
                                                font-size: 28px;
                                                font-weight: bold;
                                                color: #2563eb;
                                                margin: 0;
                                              }
                                              .invoice-number {
                                                font-size: 18px;
                                                color: #666;
                                                margin: 10px 0;
                                              }
                                              .invoice-details {
                                                background: #f8fafc;
                                                padding: 20px;
                                                border-radius: 8px;
                                                margin: 20px 0;
                                              }
                                              .detail-row {
                                                display: flex;
                                                justify-content: space-between;
                                                padding: 10px 0;
                                                border-bottom: 1px solid #e2e8f0;
                                              }
                                              .detail-row:last-child {
                                                border-bottom: none;
                                              }
                                              .label {
                                                font-weight: bold;
                                                color: #374151;
                                              }
                                              .value {
                                                color: #111827;
                                              }
                                              .items-table {
                                                width: 100%;
                                                border-collapse: collapse;
                                                margin: 20px 0;
                                                background: white;
                                                border-radius: 8px;
                                                overflow: hidden;
                                                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                                              }
                                              .items-table th {
                                                background: #f1f5f9;
                                                padding: 12px;
                                                text-align: right;
                                                font-weight: bold;
                                                color: #374151;
                                                border-bottom: 2px solid #e2e8f0;
                                              }
                                              .items-table td {
                                                padding: 12px;
                                                text-align: right;
                                                border-bottom: 1px solid #e2e8f0;
                                              }
                                              .items-table tr:last-child td {
                                                border-bottom: none;
                                              }
                                              .items-table tr:nth-child(even) {
                                                background: #f9fafb;
                                              }
                                              .total-section {
                                                background: #2563eb;
                                                color: white;
                                                padding: 15px 20px;
                                                border-radius: 8px;
                                                margin-top: 20px;
                                                text-align: center;
                                              }
                                              .total-amount {
                                                font-size: 24px;
                                                font-weight: bold;
                                              }
                                              .footer {
                                                text-align: center;
                                                margin-top: 40px;
                                                padding-top: 20px;
                                                border-top: 1px solid #e5e7eb;
                                                color: #6b7280;
                                                font-size: 14px;
                                              }
                                              .status-badge {
                                                display: inline-block;
                                                padding: 4px 12px;
                                                border-radius: 20px;
                                                font-size: 12px;
                                                font-weight: bold;
                                                text-transform: uppercase;
                                              }
                                              .status-completed {
                                                background: #dcfce7;
                                                color: #166534;
                                              }
                                              .status-pending {
                                                background: #fef3c7;
                                                color: #92400e;
                                              }
                                              .status-cancelled {
                                                background: #fee2e2;
                                                color: #991b1b;
                                              }
                                              ${
                                                transaction.status !==
                                                "completed"
                                                  ? `
                                              .modified-badge {
                                                background: #fbbf24;
                                                color: #92400e;
                                                padding: 2px 8px;
                                                border-radius: 12px;
                                                font-size: 10px;
                                                font-weight: bold;
                                                margin-right: 8px;
                                              }
                                              `
                                                  : ""
                                              }
                                            </style>
                                          </head>
                                          <body>
                                            <div class="invoice-header">
                                              <h1 class="invoice-title">فاتورة مبيعات ${transaction.status !== "completed" ? '<span class="modified-badge">معدلة</span>' : ""}</h1>
                                              <div class="invoice-number">رقم الفاتورة: ${transaction.transactionNumber}</div>
                                            </div>

                                            <div class="invoice-details">
                                              <div class="detail-row">
                                                <span class="label">العميل:</span>
                                                <span class="value">${transaction.customerName || "عميل غير محدد"}</span>
                                              </div>
                                              <div class="detail-row">
                                                <span class="label">تاريخ الفاتورة:</span>
                                                <span class="value">${
                                                  transaction.createdAt
                                                    ? new Date(
                                                        transaction.createdAt,
                                                      ).toLocaleDateString(
                                                        "ar-SA",
                                                        {
                                                          year: "numeric",
                                                          month: "long",
                                                          day: "numeric",
                                                          hour: "2-digit",
                                                          minute: "2-digit",
                                                        },
                                                      )
                                                    : "تاريخ غير محدد"
                                                }</span>
                                              </div>
                                              <div class="detail-row">
                                                <span class="label">نوع الدفع:</span>
                                                <span class="value">${transaction.paymentType === "credit" ? "دين" : "نقد"}</span>
                                              </div>
                                              <div class="detail-row">
                                                <span class="label">حالة المعاملة:</span>
                                                <span class="value">
                                                  <span class="status-badge status-${transaction.status === "completed" ? "completed" : transaction.status === "pending" ? "pending" : "cancelled"}">
                                                    ${transaction.status === "completed" ? "مكتملة" : transaction.status === "pending" ? "معلقة" : "ملغية"}
                                                  </span>
                                                </span>
                                              </div>
                                            </div>

                                            ${
                                              items.length > 0
                                                ? `
                                            <div style="margin: 20px 0;">
                                              <h3 style="color: #374151; margin-bottom: 15px;">تفاصيل الأصناف:</h3>
                                              <table class="items-table">
                                                <thead>
                                                  <tr>
                                                    <th>المنتج</th>
                                                    <th>الكمية</th>
                                                    <th>السعر</th>
                                                    <th>المجموع</th>
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  ${items
                                                    .map(
                                                      (
                                                        item: TransactionItem,
                                                      ) => `
                                                    <tr>
                                                      <td>${item.productName || "منتج غير محدد"}</td>
                                                      <td>${item.quantity || 0}</td>
                                                      <td>${Number(item.price || 0).toFixed(2)} ${transaction.currency === "USD" ? "$" : "₺"}</td>
                                                      <td>${Number(item.total || 0).toFixed(2)} ${transaction.currency === "USD" ? "$" : "₺"}</td>
                                                    </tr>
                                                  `,
                                                    )
                                                    .join("")}
                                                </tbody>
                                              </table>
                                            </div>
                                            `
                                                : ""
                                            }

                                            ${
                                              transaction.discount &&
                                              Number(transaction.discount) > 0
                                                ? `
                                            <div style="background: #fee2e2; padding: 10px; border-radius: 8px; margin: 10px 0;">
                                              <div style="display: flex; justify-content: space-between; color: #991b1b;">
                                                <span>الخصم:</span>
                                                <span>-${Number(transaction.discount).toFixed(2)} ${transaction.currency === "USD" ? "$" : "₺"}</span>
                                              </div>
                                            </div>
                                            `
                                                : ""
                                            }

                                            <div class="total-section">
                                              <div>إجمالي المبلغ</div>
                                              <div class="total-amount">${Number(transaction.total || 0).toFixed(2)} ${transaction.currency === "USD" ? "$" : "₺"}</div>
                                            </div>

                                            <div class="footer">
                                              <p>شكراً لك على التعامل معنا</p>
                                              <p>تم الطباعة في: ${new Date().toLocaleDateString(
                                                "ar-SA",
                                                {
                                                  year: "numeric",
                                                  month: "long",
                                                  day: "numeric",
                                                  hour: "2-digit",
                                                  minute: "2-digit",
                                                },
                                              )}</p>
                                            </div>

                                            <script>
                                              window.onload = function() {
                                                setTimeout(function() {
                                                  window.print();
                                                  window.close();
                                                }, 500);
                                              }
                                            </script>
                                          </body>
                                        </html>
                                      `);
                                      printWindow.document.close();
                                    }
                                  } catch (error) {
                                    console.error(
                                      "Error printing invoice:",
                                      error,
                                    );
                                    // Fallback to basic print without items
                                    const printWindow = window.open(
                                      "",
                                      "_blank",
                                    );
                                    if (printWindow) {
                                      printWindow.document.write(`
                                        <html>
                                          <head>
                                            <title>طباعة فاتورة ${transaction.transactionNumber}</title>
                                            <meta charset="UTF-8">
                                            <style>
                                              body {
                                                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                                                direction: rtl;
                                                margin: 20px;
                                                line-height: 1.6;
                                                color: #333;
                                              }
                                              .invoice-header {
                                                text-align: center;
                                                border-bottom: 3px solid #2563eb;
                                                padding-bottom: 20px;
                                                margin-bottom: 30px;
                                              }
                                              .invoice-title {
                                                font-size: 28px;
                                                font-weight: bold;
                                                color: #2563eb;
                                                margin: 0;
                                              }
                                            </style>
                                          </head>
                                          <body>
                                            <div class="invoice-header">
                                              <h1 class="invoice-title">فاتورة مبيعات</h1>
                                              <div>رقم الفاتورة: ${transaction.transactionNumber}</div>
                                            </div>
                                            <p>العميل: ${transaction.customerName || "عميل غير محدد"}</p>
                                            <p>المبلغ: ${Number(transaction.total || 0).toFixed(2)} ${transaction.currency === "USD" ? "$" : "₺"}</p>
                                            <script>
                                              window.onload = function() {
                                                setTimeout(function() {
                                                  window.print();
                                                  window.close();
                                                }, 500);
                                              }
                                            </script>
                                          </body>
                                        </html>
                                      `);
                                      printWindow.document.close();
                                    }
                                  }
                                }}
                              >
                                <Printer className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-green-600 hover:text-green-800"
                                title="تعديل المعاملة"
                                onClick={async () => {
                                  try {
                                    // Fetch transaction items for editing
                                    const itemsResponse = await fetch(
                                      `/api/transactions/${transaction.id}/items`,
                                    );
                                    const items = itemsResponse.ok
                                      ? await itemsResponse.json()
                                      : [];

                                    // Create a comprehensive edit window with all transaction details
                                    const editWindow = window.open(
                                      "",
                                      "_blank",
                                      "width=900,height=700,scrollbars=yes",
                                    );
                                    if (editWindow) {
                                      editWindow.document.write(`
                                        <html>
                                          <head>
                                            <title>تعديل فاتورة ${transaction.transactionNumber}</title>
                                            <meta charset="UTF-8">
                                            <style>
                                              body {
                                                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                                                direction: rtl;
                                                margin: 0;
                                                padding: 20px;
                                                background: #f8fafc;
                                                line-height: 1.6;
                                              }
                                              .edit-container {
                                                max-width: 800px;
                                                margin: 0 auto;
                                                background: white;
                                                border-radius: 12px;
                                                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                                                overflow: hidden;
                                              }
                                              .form-header {
                                                background: linear-gradient(135deg, #2563eb, #1d4ed8);
                                                color: white;
                                                padding: 20px;
                                                text-align: center;
                                              }
                                              .form-title {
                                                font-size: 24px;
                                                font-weight: bold;
                                                margin: 0;
                                              }
                                              .form-content {
                                                padding: 30px;
                                              }
                                              .form-section {
                                                margin-bottom: 25px;
                                                border: 1px solid #e5e7eb;
                                                border-radius: 8px;
                                                padding: 20px;
                                                background: #f9fafb;
                                              }
                                              .section-title {
                                                font-size: 18px;
                                                font-weight: bold;
                                                color: #374151;
                                                margin-bottom: 15px;
                                                border-bottom: 2px solid #2563eb;
                                                padding-bottom: 5px;
                                              }
                                              .form-row {
                                                display: grid;
                                                grid-template-columns: 1fr 1fr;
                                                gap: 15px;
                                                margin-bottom: 15px;
                                              }
                                              .form-group {
                                                margin-bottom: 15px;
                                              }
                                              .form-label {
                                                display: block;
                                                margin-bottom: 5px;
                                                font-weight: 600;
                                                color: #374151;
                                              }
                                              .form-input, .form-select {
                                                width: 100%;
                                                padding: 10px 12px;
                                                border: 2px solid #d1d5db;
                                                border-radius: 6px;
                                                font-size: 14px;
                                                text-align: right;
                                                background: white;
                                                transition: border-color 0.2s;
                                                box-sizing: border-box;
                                              }
                                              .form-input:focus, .form-select:focus {
                                                outline: none;
                                                border-color: #2563eb;
                                                box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
                                              }
                                              .items-table {
                                                width: 100%;
                                                border-collapse: collapse;
                                                margin-top: 15px;
                                                border: 1px solid #e5e7eb;
                                                border-radius: 6px;
                                                overflow: hidden;
                                              }
                                              .items-table th {
                                                background: #f3f4f6;
                                                padding: 12px 8px;
                                                text-align: right;
                                                font-weight: bold;
                                                color: #374151;
                                                border-bottom: 2px solid #e5e7eb;
                                              }
                                              .items-table td {
                                                padding: 10px 8px;
                                                border-bottom: 1px solid #e5e7eb;
                                                background: white;
                                              }
                                              .items-table tr:hover td {
                                                background: #f9fafb;
                                              }
                                              .form-buttons {
                                                display: flex;
                                                gap: 12px;
                                                justify-content: center;
                                                margin-top: 30px;
                                                padding-top: 20px;
                                                border-top: 1px solid #e5e7eb;
                                              }
                                              .btn {
                                                padding: 12px 24px;
                                                border: none;
                                                border-radius: 6px;
                                                font-size: 14px;
                                                font-weight: 600;
                                                cursor: pointer;
                                                transition: all 0.2s;
                                                min-width: 120px;
                                              }
                                              .btn-primary {
                                                background: #2563eb;
                                                color: white;
                                              }
                                              .btn-primary:hover {
                                                background: #1d4ed8;
                                                transform: translateY(-1px);
                                              }
                                              .btn-secondary {
                                                background: #6b7280;
                                                color: white;
                                              }
                                              .btn-secondary:hover {
                                                background: #4b5563;
                                              }
                                              .modified-badge {
                                                background: #fbbf24;
                                                color: #92400e;
                                                padding: 4px 12px;
                                                border-radius: 20px;
                                                font-size: 12px;
                                                font-weight: bold;
                                                margin-right: 10px;
                                              }
                                              .status-info {
                                                background: #e0f2fe;
                                                border: 1px solid #81d4fa;
                                                padding: 12px;
                                                border-radius: 6px;
                                                margin-bottom: 20px;
                                                color: #0277bd;
                                              }
                                            </style>
                                          </head>
                                          <body>
                                            <div class="edit-container">
                                              <div class="form-header">
                                                <h1 class="form-title">
                                                  تعديل فاتورة ${transaction.transactionNumber}
                                                  <span class="modified-badge">معدلة</span>
                                                </h1>
                                              </div>

                                              <div class="form-content">
                                                <div class="status-info">
                                                  ℹ️ سيتم حفظ جميع التعديلات مباشرة في قاعدة البيانات
                                                </div>

                                                <form onsubmit="handleSubmit(event)">
                                                  <!-- معلومات العميل -->
                                                  <div class="form-section">
                                                    <div class="section-title">معلومات العميل</div>
                                                    <div class="form-row">
                                                      <div class="form-group">
                                                        <label class="form-label">اسم العميل *</label>
                                                        <input type="text" class="form-input" id="customerName" value="${transaction.customerName || ""}" required>
                                                      </div>
                                                      <div class="form-group">
                                                        <label class="form-label">نوع الدفع</label>
                                                        <select class="form-select" id="paymentType" required>
                                                          <option value="cash" ${transaction.paymentType === "cash" ? "selected" : ""}>نقد</option>
                                                          <option value="credit" ${transaction.paymentType === "credit" ? "selected" : ""}>دين</option>
                                                        </select>
                                                      </div>
                                                    </div>
                                                    <div class="form-row">
                                                      <div class="form-group">
                                                        <label class="form-label">العملة</label>
                                                        <select class="form-select" id="currency" required>
                                                          <option value="TRY" ${transaction.currency === "TRY" ? "selected" : ""}>ليرة تركية (₺)</option>
                                                          <option value="USD" ${transaction.currency === "USD" ? "selected" : ""}>دولار أمريكي ($)</option>
                                                        </select>
                                                      </div>
                                                      <div class="form-group">
                                                        <label class="form-label">حالة المعاملة</label>
                                                        <select class="form-select" id="status" required>
                                                          <option value="completed" ${transaction.status === "completed" ? "selected" : ""}>مكتملة</option>
                                                          <option value="pending" ${transaction.status === "pending" ? "selected" : ""}>معلقة</option>
                                                          <option value="cancelled" ${transaction.status === "cancelled" ? "selected" : ""}>ملغية</option>
                                                        </select>
                                                      </div>
                                                    </div>
                                                  </div>

                                                  <!-- المبالغ المالية -->
                                                  <div class="form-section">
                                                    <div class="section-title">المبالغ المالية</div>
                                                    <div class="form-row">
                                                      <div class="form-group">
                                                        <label class="form-label">المبلغ الإجمالي *</label>
                                                        <input type="number" class="form-input" id="total" value="${transaction.total || 0}" step="0.01" min="0" required>
                                                      </div>
                                                      <div class="form-group">
                                                        <label class="form-label">الخصم</label>
                                                        <input type="number" class="form-input" id="discount" value="${transaction.discount || 0}" step="0.01" min="0">
                                                      </div>
                                                    </div>
                                                    <div class="form-row">
                                                      <div class="form-group">
                                                        <label class="form-label">الضريبة</label>
                                                        <input type="number" class="form-input" id="tax" value="${transaction.tax || 0}" step="0.01" min="0">
                                                      </div>
                                                      <div class="form-group">
                                                        <label class="form-label">نوع المعاملة</label>
                                                        <select class="form-select" id="transactionType" required>
                                                          <option value="sale" ${transaction.transactionType === "sale" ? "selected" : ""}>مبيعات</option>
                                                          <option value="debt_collection" ${transaction.transactionType === "debt_collection" ? "selected" : ""}>تحصيل دين</option>
                                                        </select>
                                                      </div>
                                                    </div>
                                                  </div>

                                                  ${
                                                    items.length > 0
                                                      ? `
                                                  <!-- أصناف الفاتورة -->
                                                  <div class="form-section">
                                                    <div class="section-title">أصناف الفاتورة</div>
                                                    <div id="items-container">
                                                      ${items
                                                        .map(
                                                          (item: TransactionItem, index: number) => `
                                                        <div class="item-row" data-item-id="${item.id || index}" style="display: grid; grid-template-columns: 1fr 120px 120px 120px 40px; gap: 10px; margin-bottom: 10px; padding: 10px; border: 1px solid #e5e7eb; border-radius: 6px; background: white;">
                                                          <input type="text" class="form-input item-name" value="${item.productName || ""}" placeholder="اسم المنتج" required>
                                                          <input type="number" class="form-input item-quantity" value="${item.quantity || 0}" placeholder="الكمية" min="0" step="1" required>
                                                          <input type="number" class="form-input item-price" value="${Number(item.price || 0).toFixed(2)}" placeholder="السعر" min="0" step="0.01" required>
                                                          <input type="number" class="form-input item-total" value="${Number(item.total || 0).toFixed(2)}" placeholder="المجموع" readonly style="background: #f3f4f6;">
                                                          <button type="button" class="btn-delete-item" onclick="removeItem(this)" style="background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">🗑️</button>
                                                        </div>
                                                      `,
                                                        )
                                                        .join("")}
                                                    </div>
                                                    <button type="button" onclick="addNewItem()" style="background: #10b981; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; margin-top: 10px;">➕ إضافة صنف جديد</button>
                                                  </div>
                                                  `
                                                      : `
                                                  <!-- أصناف الفاتورة -->
                                                  <div class="form-section">
                                                    <div class="section-title">أصناف الفاتورة</div>
                                                    <div id="items-container">
                                                      <!-- سيتم إضافة الأصناف هنا -->
                                                    </div>
                                                    <button type="button" onclick="addNewItem()" style="background: #10b981; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer;">➕ إضافة صنف جديد</button>
                                                  </div>
                                                  `
                                                  }

                                                  <div class="form-buttons">
                                                    <button type="submit" class="btn btn-primary">💾 حفظ التعديلات</button>
                                                    <button type="button" class="btn btn-secondary" onclick="window.close()">✖️ إلغاء</button>
                                                  </div>
                                                </form>
                                              </div>
                                            </div>

                                            <script>
                                              let itemCounter = ${items.length};

                                              // Auto-calculate item total when quantity or price changes
                                              function setupItemCalculation(row) {
                                                const quantityInput = row.querySelector('.item-quantity');
                                                const priceInput = row.querySelector('.item-price');
                                                const totalInput = row.querySelector('.item-total');

                                                function calculateTotal() {
                                                  const quantity = parseFloat(quantityInput.value) || 0;
                                                  const price = parseFloat(priceInput.value) || 0;
                                                  const total = quantity * price;
                                                  totalInput.value = total.toFixed(2);
                                                  updateGrandTotal();
                                                }

                                                quantityInput.addEventListener('input', calculateTotal);
                                                priceInput.addEventListener('input', calculateTotal);
                                              }

                                              // Update grand total based on all items
                                              function updateGrandTotal() {
                                                const totalInputs = document.querySelectorAll('.item-total');
                                                let grandTotal = 0;
                                                totalInputs.forEach(input => {
                                                  grandTotal += parseFloat(input.value) || 0;
                                                });
                                                
                                                const discount = parseFloat(document.getElementById('discount').value) || 0;
                                                const tax = parseFloat(document.getElementById('tax').value) || 0;
                                                const finalTotal = grandTotal - discount + tax;
                                                
                                                document.getElementById('total').value = finalTotal.toFixed(2);
                                              }

                                              // Add new item row
                                              function addNewItem() {
                                                const container = document.getElementById('items-container');
                                                const newRow = document.createElement('div');
                                                newRow.className = 'item-row';
                                                newRow.setAttribute('data-item-id', 'new-' + itemCounter);
                                                newRow.style.cssText = 'display: grid; grid-template-columns: 1fr 120px 120px 120px 40px; gap: 10px; margin-bottom: 10px; padding: 10px; border: 1px solid #e5e7eb; border-radius: 6px; background: white;';
                                                newRow.innerHTML = \`
                                                  <input type="text" class="form-input item-name" placeholder="اسم المنتج" required>
                                                  <input type="number" class="form-input item-quantity" value="1" placeholder="الكمية" min="0" step="1" required>
                                                  <input type="number" class="form-input item-price" value="0.00" placeholder="السعر" min="0" step="0.01" required>
                                                  <input type="number" class="form-input item-total" value="0.00" placeholder="المجموع" readonly style="background: #f3f4f6;">
                                                  <button type="button" class="btn-delete-item" onclick="removeItem(this)" style="background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">🗑️</button>
                                                \`;
                                                container.appendChild(newRow);
                                                setupItemCalculation(newRow);
                                                itemCounter++;
                                              }

                                              // Remove item row
                                              function removeItem(button) {
                                                const row = button.closest('.item-row');
                                                row.remove();
                                                updateGrandTotal();
                                              }

                                              // Setup existing items
                                              document.addEventListener('DOMContentLoaded', function() {
                                                document.querySelectorAll('.item-row').forEach(row => {
                                                  setupItemCalculation(row);
                                                });
                                                
                                                // Setup discount and tax calculation
                                                document.getElementById('discount').addEventListener('input', updateGrandTotal);
                                                document.getElementById('tax').addEventListener('input', updateGrandTotal);
                                              });

                                              function handleSubmit(event) {
                                                event.preventDefault();

                                                // Collect transaction data
                                                const formData = {
                                                  customerName: document.getElementById('customerName').value.trim(),
                                                  total: document.getElementById('total').value,
                                                  discount: document.getElementById('discount').value || '0',
                                                  tax: document.getElementById('tax').value || '0',
                                                  paymentType: document.getElementById('paymentType').value,
                                                  currency: document.getElementById('currency').value,
                                                  status: document.getElementById('status').value,
                                                  transactionType: document.getElementById('transactionType').value
                                                };

                                                // Collect items data
                                                const items = [];
                                                document.querySelectorAll('.item-row').forEach(row => {
                                                  const itemId = row.getAttribute('data-item-id');
                                                  const productName = row.querySelector('.item-name').value.trim();
                                                  const quantity = parseFloat(row.querySelector('.item-quantity').value) || 0;
                                                  const price = parseFloat(row.querySelector('.item-price').value) || 0;
                                                  const total = parseFloat(row.querySelector('.item-total').value) || 0;

                                                  if (productName && quantity > 0) {
                                                    items.push({
                                                      id: itemId.startsWith('new-') ? null : itemId,
                                                      productName,
                                                      quantity,
                                                      price: price.toFixed(2),
                                                      total: total.toFixed(2)
                                                    });
                                                  }
                                                });

                                                // Validate required fields
                                                if (!formData.customerName) {
                                                  alert('يرجى إدخال اسم العميل');
                                                  return;
                                                }

                                                if (parseFloat(formData.total) < 0) {
                                                  alert('المبلغ الإجمالي يجب أن يكون أكبر من أو يساوي صفر');
                                                  return;
                                                }

                                                if (items.length === 0) {
                                                  alert('يرجى إضافة صنف واحد على الأقل');
                                                  return;
                                                }

                                                // Show loading state
                                                document.querySelector('.btn-primary').innerHTML = '⏳ جارٍ الحفظ...';
                                                document.querySelector('.btn-primary').disabled = true;

                                                // Send update request to parent window
                                                if (window.opener) {
                                                  window.opener.postMessage({
                                                    type: 'UPDATE_TRANSACTION',
                                                    transactionId: '${transaction.id}',
                                                    data: formData,
                                                    items: items
                                                  }, '*');
                                                }

                                                // Close window after a delay to ensure message is sent
                                                setTimeout(() => {
                                                  alert('✅ تم حفظ التعديلات بنجاح!\\n\\nسيتم تحديث صفحة المعاملات تلقائياً.');
                                                  window.close();
                                                }, 500);
                                              }
                                            </script>
                                          </body>
                                        </html>
                                      `);
                                      editWindow.document.close();
                                    }
                                  } catch (error) {
                                    console.error(
                                      "Error opening edit window:",
                                      error,
                                    );
                                    toast({
                                      title: "خطأ",
                                      description: "فشل في فتح نافذة التعديل",
                                      variant: "destructive",
                                    });
                                  }
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>

      <InvoiceForm
        open={showInvoiceForm}
        onClose={() => setShowInvoiceForm(false)}
      />

      <InvoiceViewer
        open={showInvoice}
        onClose={() => {
          setShowInvoice(false);
          setSelectedTransaction(null);
        }}
        transaction={selectedTransaction}
      />

      <Dialog open={showBarcodeScanner} onOpenChange={setShowBarcodeScanner}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>مسح باركود المنتج</DialogTitle>
          </DialogHeader>
          <BarcodeScanner
            onProductSelect={(product: Product) => {
              // Add product to invoice - this would typically open the invoice form with pre-filled data
              console.log("Selected product:", product);
              setShowBarcodeScanner(false);
              setShowInvoiceForm(true);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}