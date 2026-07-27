import React, { useState, useEffect, useRef } from "react";
import {
  Mic,
  MicOff,
  X,
  Bot,
  User,
  ShoppingCart,
  Trash2,
  Save,
  Download,
  CheckCircle2,
  AlertCircle,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";
import { useVoiceSearch } from "../hooks/useVoiceSearch";
import { parseVoiceOrderCommand } from "../lib/voiceOrderParser";
import {
  useOrder,
  addOrderItem,
  removeOrderItem,
  clearOrder,
  OrderItem,
} from "../lib/order";
import { InventoryRow, formatCurrency } from "../lib/inventory";

interface VoiceOrderAssistantModalProps {
  open: boolean;
  onClose: () => void;
  inventory: InventoryRow[];
  customerName: string;
  setCustomerName: (name: string) => void;
  onSaveOrder: () => void;
  onDownloadExcel: () => void;
}

interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  time: string;
  status?: "success" | "error" | "info";
}

export const VoiceOrderAssistantModal: React.FC<VoiceOrderAssistantModalProps> = ({
  open,
  onClose,
  inventory,
  customerName,
  setCustomerName,
  onSaveOrder,
  onDownloadExcel,
}) => {
  const order = useOrder();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "init",
      sender: "assistant",
      text: '¡Hola! Soy tu asistente de pedidos por voz. Puedes decir algo como:\n• "Agregar 5 unidades de la referencia B0102 en azul talla L"\n• "Cliente Comercializadora S.A."\n• "Vaciar pedido" o "Guardar pedido"',
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "info",
    },
  ]);
  const [audioFeedback, setAudioFeedback] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Text to Speech
  const speakText = (text: string) => {
    if (!audioFeedback || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "es-CO";
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch {
      // Ignore speech synthesis errors
    }
  };

  const handleVoiceCommand = (transcriptText: string) => {
    if (!transcriptText || transcriptText.trim().length === 0) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    // Add user message
    const userMsgId = Date.now().toString();
    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        sender: "user",
        text: transcriptText,
        time: timeStr,
      },
    ]);

    // Parse command
    const parsed = parseVoiceOrderCommand(transcriptText, inventory);

    let assistantResponse = parsed.feedbackMessage;
    let responseStatus: "success" | "error" | "info" = "info";

    switch (parsed.intent) {
      case "ADD": {
        if (parsed.matchedItems && parsed.matchedItems.length > 0) {
          const item = parsed.matchedItems[0];
          const qty = parsed.quantity || 1;
          const result = addOrderItem(
            {
              sku: item.sku,
              referencia: item.referencia,
              descripcion: item.descripcion,
              talla: item.talla,
              color: item.color,
              codColor: item.codColor,
              pvm: item.pvm,
              saldo: item.saldo,
            },
            qty
          );

          if (result.success) {
            responseStatus = "success";
            if (result.isLimit) {
              assistantResponse = `Agregado ${result.currentQty} unidad(es) de ${item.referencia} (límite de inventario alcanzado).`;
            }
          } else {
            responseStatus = "error";
            assistantResponse = `No hay más unidades disponibles de ${item.referencia} (stock: ${item.saldo}).`;
          }
        } else {
          responseStatus = "error";
        }
        break;
      }
      case "REMOVE": {
        if (parsed.matchedItems && parsed.matchedItems.length > 0) {
          const item = parsed.matchedItems[0];
          removeOrderItem(item.sku);
          responseStatus = "success";
        } else {
          responseStatus = "error";
        }
        break;
      }
      case "CLEAR": {
        clearOrder();
        responseStatus = "success";
        break;
      }
      case "SET_CLIENT": {
        if (parsed.clientName) {
          setCustomerName(parsed.clientName);
          responseStatus = "success";
        }
        break;
      }
      case "SAVE": {
        if (order.length === 0) {
          responseStatus = "error";
          assistantResponse = "No se puede guardar: el pedido está vacío.";
        } else if (!customerName.trim()) {
          responseStatus = "error";
          assistantResponse = "Por favor indica el nombre del cliente antes de guardar.";
        } else {
          responseStatus = "success";
          onSaveOrder();
        }
        break;
      }
      case "EXPORT": {
        if (order.length === 0) {
          responseStatus = "error";
          assistantResponse = "El pedido está vacío, no se puede exportar Excel.";
        } else {
          responseStatus = "success";
          onDownloadExcel();
        }
        break;
      }
      default: {
        responseStatus = "error";
        break;
      }
    }

    // Add assistant response message
    setMessages((prev) => [
      ...prev,
      {
        id: (Date.now() + 1).toString(),
        sender: "assistant",
        text: assistantResponse,
        time: timeStr,
        status: responseStatus,
      },
    ]);

    // Speak response
    speakText(assistantResponse);
  };

  const { isListening, isSupported, transcript, toggleListening } = useVoiceSearch({
    onResult: (text) => {
      // When speech pauses or completes
    },
  });

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!open) return null;

  const totalItems = order.reduce((s, i) => s + i.cantidad, 0);
  const totalPrice = order.reduce((s, i) => s + i.cantidad * i.pvm, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md animate-fade-in">
      <div className="flex h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-card/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/20 text-accent">
              <Bot className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">Asistente de Pedidos por Voz</h2>
              <p className="text-xs text-muted-foreground">
                Crea, modifica y guarda pedidos hablando naturalmente
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAudioFeedback(!audioFeedback)}
              title={audioFeedback ? "Desactivar respuesta en voz" : "Activar respuesta en voz"}
              className="rounded-xl p-2 text-muted-foreground hover:bg-accent/10 hover:text-foreground transition-colors"
            >
              {audioFeedback ? <Volume2 className="h-5 w-5 text-accent" /> : <VolumeX className="h-5 w-5" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content Body: Chat + Live Order Summary */}
        <div className="grid flex-1 grid-cols-1 overflow-hidden md:grid-cols-3">
          {/* Chat Conversation */}
          <div className="flex flex-col border-r border-border md:col-span-2">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${
                    msg.sender === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {msg.sender === "assistant" && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                      <Bot className="h-4 w-4" />
                    </div>
                  )}

                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                      msg.sender === "user"
                        ? "bg-accent text-accent-foreground rounded-br-none"
                        : "bg-muted/60 border border-border text-foreground rounded-bl-none"
                    }`}
                  >
                    <p className="whitespace-pre-line leading-relaxed">{msg.text}</p>
                    <span className="mt-1 block text-[10px] opacity-60 text-right">
                      {msg.time}
                    </span>
                  </div>

                  {msg.sender === "user" && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Mic Listening Controller Bar */}
            <div className="border-t border-border bg-card p-4 space-y-3">
              {transcript && (
                <div className="rounded-xl bg-accent/10 p-2.5 text-xs text-accent-foreground flex items-center justify-between">
                  <span className="font-medium italic">"{transcript}"</span>
                  <button
                    type="button"
                    onClick={() => handleVoiceCommand(transcript)}
                    className="ml-2 text-accent hover:underline font-semibold"
                  >
                    Enviar comando
                  </button>
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={toggleListening}
                  className={`relative flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg transition-all duration-300 ${
                    isListening
                      ? "bg-red-500 text-white ring-4 ring-red-500/30 animate-pulse scale-105"
                      : "bg-accent text-accent-foreground hover:scale-105 active:scale-95"
                  }`}
                  title={isListening ? "Detener micrófono" : "Hablar ahora"}
                >
                  {isListening && (
                    <span className="absolute inset-0 rounded-2xl bg-red-500/50 animate-ping" />
                  )}
                  {isListening ? <Mic className="h-7 w-7" /> : <Mic className="h-7 w-7" />}
                </button>

                <div className="flex-1">
                  <p className="text-sm font-semibold">
                    {isListening ? "Escuchando tu voz..." : "Haz clic en el micrófono para hablar"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Ej: "Agregar 5 unidades de B0102 azul talla L"
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Side Panel: Order Live Summary */}
          <div className="flex flex-col bg-muted/20 p-4 space-y-4 overflow-y-auto">
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-bold">
                <ShoppingCart className="h-4 w-4 text-accent" />
                Resumen del Pedido
              </h3>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between border-b border-border pb-1.5">
                  <span className="text-muted-foreground">Cliente:</span>
                  <span className="font-semibold text-foreground truncate max-w-[150px]">
                    {customerName || "Sin asignar"}
                  </span>
                </div>
                <div className="flex justify-between border-b border-border pb-1.5">
                  <span className="text-muted-foreground">Total artículos:</span>
                  <span className="font-bold text-accent">{totalItems} uds</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total PVM:</span>
                  <span className="font-bold text-foreground">{formatCurrency(totalPrice)}</span>
                </div>
              </div>
            </div>

            {/* Item List */}
            <div className="flex-1 space-y-2 overflow-y-auto">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Artículos ({order.length})
              </span>

              {order.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                  El pedido está vacío. Háblale al asistente para agregar productos.
                </div>
              ) : (
                order.map((item) => (
                  <div
                    key={item.sku}
                    className="flex items-center justify-between rounded-xl border border-border bg-card p-2.5 text-xs shadow-sm"
                  >
                    <div>
                      <span className="font-bold text-foreground">{item.referencia}</span>
                      <p className="text-[10px] text-muted-foreground">
                        {item.color} - Talla {item.talla}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-lg bg-accent/10 px-2 py-0.5 font-bold text-accent">
                        x{item.cantidad}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Quick Voice Action Buttons */}
            <div className="space-y-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => handleVoiceCommand("guardar pedido")}
                disabled={order.length === 0}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground shadow transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                Guardar Pedido
              </button>

              <button
                type="button"
                onClick={() => handleVoiceCommand("vaciar pedido")}
                disabled={order.length === 0}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-border py-2 text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Vaciar Pedido
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
