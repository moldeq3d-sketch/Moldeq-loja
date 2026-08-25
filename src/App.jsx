import { useState, useEffect, useRef, useMemo } from "react";
import { ShoppingCart, X, Plus, Minus, Trash2, Pencil, Lock, ImagePlus, Check, ChevronLeft, Search, Settings, PackagePlus, Unlock } from "lucide-react";
import { supabase } from "./supabaseClient";
import { INITIAL_PRODUCTS, LOGO_URI, DEFAULT_WHATSAPP, ADMIN_PIN, STORAGE_KEY } from "./data";

function formatBRL(v) {
  return "R$ " + Number(v).toFixed(2).replace(".", ",");
}

function uid() {
  return "p" + Math.random().toString(36).slice(2, 9);
}

function buildWhatsAppMessage(cart, products, note) {
  const lines = ["Olá! Vim pelo site da Moldeq e gostaria de fazer o seguinte pedido:", ""];
  let total = 0;
  cart.forEach((item) => {
    const p = products.find((pr) => pr.id === item.productId);
    if (!p) return;
    const subtotal = p.price * item.qty;
    total += subtotal;
    lines.push("• " + p.name + " — cor " + item.colorName + " — qtd " + item.qty + " — " + formatBRL(subtotal));
  });
  lines.push("");
  lines.push("Total: " + formatBRL(total));
  if (note && note.trim()) {
    lines.push("");
    lines.push("Obs: " + note.trim());
  }
  return lines.join("\n");
}

function fileToDataUri(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const PALETTE = {
  bg: "#14161C",
  bg2: "#0F1116",
  surface: "#1C1F29",
  surface2: "#232733",
  border: "rgba(241,238,228,0.09)",
  gold: "#D9A44C",
  goldBright: "#F0C77A",
  purple: "#8A6FB0",
  purpleDeep: "#6B4E9E",
  text: "#F1EEE4",
  muted: "#9297A3",
  danger: "#C0392B",
};

function LayerLines({ height = 28, opacity = 0.35, color = PALETTE.gold }) {
  return (
    <div
      aria-hidden="true"
      style={{
        height,
        width: "100%",
        backgroundImage:
          "repeating-linear-gradient(0deg, " +
          color +
          " 0px, " +
          color +
          " 1px, transparent 1px, transparent 6px)",
        opacity,
      }}
    />
  );
}

function ColorSwatch({ color, selected, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={color.name + (disabled ? " — esgotado" : "")}
      style={{
        width: 26,
        height: 26,
        borderRadius: "50%",
        background: color.hex,
        border: selected ? "2px solid " + PALETTE.goldBright : "2px solid rgba(241,238,228,0.25)",
        boxShadow: selected ? "0 0 0 3px rgba(240,199,122,0.25)" : "none",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.3 : 1,
        position: "relative",
        flexShrink: 0,
      }}
    >
      {disabled && (
        <span
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ width: "140%", height: 1.5, background: "#fff", transform: "rotate(45deg)" }} />
        </span>
      )}
    </button>
  );
}

function ProductCard({ product, onAddToCart, toast }) {
  const availableColors = product.colors.filter((c) => c.stock > 0);
  const [colorName, setColorName] = useState(availableColors[0] ? availableColors[0].name : (product.colors[0] ? product.colors[0].name : ""));
  const [qty, setQty] = useState(1);
  const selectedColor = product.colors.find((c) => c.name === colorName) || product.colors[0];
  const outOfStock = availableColors.length === 0;
  const maxQty = selectedColor ? selectedColor.stock : 0;

  useEffect(() => {
    setQty(1);
  }, [colorName]);

  return (
    <div
      style={{
        background: PALETTE.surface,
        borderRadius: 14,
        overflow: "hidden",
        border: "1px solid " + PALETTE.border,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <LayerLines height={10} opacity={0.5} />
      <div style={{ position: "relative", aspectRatio: "4/3", background: "#0C0D11" }}>
        <img
          src={product.images[0]}
          alt={product.name}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
        {outOfStock && (
          <div
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              background: "rgba(20,22,28,0.85)",
              color: PALETTE.muted,
              fontSize: 11,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              padding: "4px 10px",
              borderRadius: 999,
              border: "1px solid " + PALETTE.border,
            }}
          >
            Esgotado
          </div>
        )}
      </div>
      <div style={{ padding: "16px 16px 18px", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
        <div>
          <h3 style={{ margin: 0, fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, fontWeight: 600, color: PALETTE.text }}>
            {product.name}
          </h3>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: PALETTE.muted, lineHeight: 1.45 }}>{product.description}</p>
        </div>

        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700, color: PALETTE.goldBright }}>
          {product.priceFrom ? "a partir de " : ""}
          {formatBRL(product.price)}
        </div>

        {product.colors.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {product.colors.map((c) => (
              <ColorSwatch
                key={c.name}
                color={c}
                selected={colorName === c.name}
                disabled={c.stock <= 0}
                onClick={() => setColorName(c.name)}
              />
            ))}
          </div>
        )}

        <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 10, paddingTop: 4 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              border: "1px solid " + PALETTE.border,
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              disabled={outOfStock}
              style={{ background: "transparent", border: "none", color: PALETTE.text, padding: "8px 10px", cursor: "pointer" }}
            >
              <Minus size={14} />
            </button>
            <span style={{ minWidth: 22, textAlign: "center", fontSize: 14, color: PALETTE.text }}>{qty}</span>
            <button
              type="button"
              onClick={() => setQty((q) => Math.min(maxQty || 1, q + 1))}
              disabled={outOfStock}
              style={{ background: "transparent", border: "none", color: PALETTE.text, padding: "8px 10px", cursor: "pointer" }}
            >
              <Plus size={14} />
            </button>
          </div>
          <button
            type="button"
            disabled={outOfStock}
            onClick={() => {
              onAddToCart(product.id, colorName, qty);
              toast(product.name + " adicionado ao carrinho");
            }}
            style={{
              flex: 1,
              background: outOfStock ? "rgba(217,164,76,0.15)" : "linear-gradient(135deg," + PALETTE.gold + "," + PALETTE.goldBright + ")",
              color: outOfStock ? PALETTE.muted : "#1A1204",
              border: "none",
              borderRadius: 10,
              padding: "10px 12px",
              fontWeight: 700,
              fontSize: 13,
              cursor: outOfStock ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <ShoppingCart size={15} />
            {outOfStock ? "Indisponível" : "Adicionar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CartDrawer({ open, onClose, cart, products, onRemove, onQtyChange, whatsapp, note, setNote, onSent }) {
  const total = cart.reduce((sum, item) => {
    const p = products.find((pr) => pr.id === item.productId);
    return sum + (p ? p.price * item.qty : 0);
  }, 0);

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(8,9,12,0.6)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.25s ease",
          zIndex: 40,
        }}
      />
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          height: "100%",
          width: "min(400px, 100vw)",
          background: PALETTE.bg2,
          borderLeft: "1px solid " + PALETTE.border,
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.3s ease",
          zIndex: 41,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ padding: "20px 20px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid " + PALETTE.border }}>
          <h2 style={{ margin: 0, fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, color: PALETTE.text }}>Seu carrinho</h2>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: PALETTE.muted, cursor: "pointer" }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {cart.length === 0 ? (
            <p style={{ color: PALETTE.muted, fontSize: 14 }}>Seu carrinho está vazio. Adicione produtos do catálogo para montar seu pedido.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {cart.map((item, idx) => {
                const p = products.find((pr) => pr.id === item.productId);
                if (!p) return null;
                return (
                  <div key={idx} style={{ display: "flex", gap: 10, borderBottom: "1px solid " + PALETTE.border, paddingBottom: 14 }}>
                    <img src={p.images[0]} alt={p.name} style={{ width: 56, height: 56, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, color: PALETTE.text, fontWeight: 600 }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: PALETTE.muted, marginTop: 2 }}>Cor: {item.colorName}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                        <button onClick={() => onQtyChange(idx, -1)} style={{ background: PALETTE.surface, border: "1px solid " + PALETTE.border, borderRadius: 6, color: PALETTE.text, cursor: "pointer", padding: "2px 6px" }}>
                          <Minus size={12} />
                        </button>
                        <span style={{ fontSize: 13, color: PALETTE.text }}>{item.qty}</span>
                        <button onClick={() => onQtyChange(idx, 1)} style={{ background: PALETTE.surface, border: "1px solid " + PALETTE.border, borderRadius: 6, color: PALETTE.text, cursor: "pointer", padding: "2px 6px" }}>
                          <Plus size={12} />
                        </button>
                        <span style={{ marginLeft: "auto", fontSize: 13, color: PALETTE.goldBright, fontWeight: 700 }}>{formatBRL(p.price * item.qty)}</span>
                      </div>
                    </div>
                    <button onClick={() => onRemove(idx)} style={{ background: "transparent", border: "none", color: PALETTE.muted, cursor: "pointer", alignSelf: "flex-start" }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <div style={{ padding: 20, borderTop: "1px solid " + PALETTE.border, display: "flex", flexDirection: "column", gap: 12 }}>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Observações (opcional): endereço, prazo, personalização..."
              rows={2}
              style={{
                width: "100%",
                background: PALETTE.surface,
                border: "1px solid " + PALETTE.border,
                borderRadius: 8,
                color: PALETTE.text,
                padding: 10,
                fontSize: 13,
                resize: "vertical",
                fontFamily: "inherit",
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, color: PALETTE.text }}>
              <span>Total</span>
              <span style={{ fontWeight: 700, color: PALETTE.goldBright }}>{formatBRL(total)}</span>
            </div>
            <a
              href={"https://wa.me/" + whatsapp + "?text=" + encodeURIComponent(buildWhatsAppMessage(cart, products, note))}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onSent}
              style={{
                textDecoration: "none",
                textAlign: "center",
                background: "#25D366",
                color: "#0A2E1A",
                fontWeight: 700,
                padding: "13px 16px",
                borderRadius: 10,
                fontSize: 14,
              }}
            >
              Finalizar pedido no WhatsApp
            </a>
          </div>
        )}
      </div>
    </>
  );
}

function AdminProductForm({ product, onSave, onCancel, onDelete }) {
  const [form, setForm] = useState(() => JSON.parse(JSON.stringify(product)));
  const fileInputRef = useRef(null);

  function updateField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function updateColor(idx, field, value) {
    setForm((f) => {
      const colors = [...f.colors];
      colors[idx] = { ...colors[idx], [field]: field === "stock" ? Number(value) : value };
      return { ...f, colors };
    });
  }

  function addColor() {
    setForm((f) => ({ ...f, colors: [...f.colors, { name: "Nova cor", hex: "#D9A44C", stock: 0 }] }));
  }

  function removeColor(idx) {
    setForm((f) => ({ ...f, colors: f.colors.filter((_, i) => i !== idx) }));
  }

  async function handleImageUpload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const uri = await fileToDataUri(file);
    setForm((f) => ({ ...f, images: [uri, ...f.images.slice(1)] }));
  }

  return (
    <div style={{ background: PALETTE.surface2, borderRadius: 12, padding: 18, border: "1px solid " + PALETTE.border, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
          <img src={form.images[0]} alt={form.name} style={{ width: 110, height: 110, objectFit: "cover", borderRadius: 10, border: "1px solid " + PALETTE.border }} />
          <button
            type="button"
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "1px solid " + PALETTE.border, color: PALETTE.text, borderRadius: 8, padding: "6px 10px", fontSize: 12, cursor: "pointer" }}
          >
            <ImagePlus size={13} /> Trocar foto
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display: "none" }} />
        </div>

        <div style={{ flex: 1, minWidth: 220, display: "flex", flexDirection: "column", gap: 10 }}>
          <label style={{ fontSize: 12, color: PALETTE.muted }}>
            Nome do produto
            <input
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              style={{ width: "100%", marginTop: 4, background: PALETTE.surface, border: "1px solid " + PALETTE.border, borderRadius: 8, color: PALETTE.text, padding: "8px 10px", fontSize: 14, boxSizing: "border-box" }}
            />
          </label>
          <label style={{ fontSize: 12, color: PALETTE.muted }}>
            Descrição
            <textarea
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              rows={2}
              style={{ width: "100%", marginTop: 4, background: PALETTE.surface, border: "1px solid " + PALETTE.border, borderRadius: 8, color: PALETTE.text, padding: "8px 10px", fontSize: 13, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
            />
          </label>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <label style={{ fontSize: 12, color: PALETTE.muted }}>
              Preço (R$)
              <input
                type="number"
                step="0.01"
                value={form.price}
                onChange={(e) => updateField("price", Number(e.target.value))}
                style={{ display: "block", marginTop: 4, width: 110, background: PALETTE.surface, border: "1px solid " + PALETTE.border, borderRadius: 8, color: PALETTE.text, padding: "8px 10px", fontSize: 14, boxSizing: "border-box" }}
              />
            </label>
            <label style={{ fontSize: 12, color: PALETTE.muted, display: "flex", alignItems: "center", gap: 6, marginTop: 20 }}>
              <input type="checkbox" checked={form.priceFrom} onChange={(e) => updateField("priceFrom", e.target.checked)} />
              Mostrar "a partir de"
            </label>
            <label style={{ fontSize: 12, color: PALETTE.muted, display: "flex", alignItems: "center", gap: 6, marginTop: 20 }}>
              <input type="checkbox" checked={form.active} onChange={(e) => updateField("active", e.target.checked)} />
              Ativo na loja
            </label>
          </div>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 12, color: PALETTE.muted, marginBottom: 6 }}>Cores e estoque</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {form.colors.map((c, idx) => (
            <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <input
                type="color"
                value={c.hex}
                onChange={(e) => updateColor(idx, "hex", e.target.value)}
                style={{ width: 32, height: 32, border: "none", background: "none", padding: 0, cursor: "pointer" }}
              />
              <input
                value={c.name}
                onChange={(e) => updateColor(idx, "name", e.target.value)}
                placeholder="Nome da cor"
                style={{ width: 130, background: PALETTE.surface, border: "1px solid " + PALETTE.border, borderRadius: 8, color: PALETTE.text, padding: "6px 8px", fontSize: 13 }}
              />
              <input
                type="number"
                value={c.stock}
                onChange={(e) => updateColor(idx, "stock", e.target.value)}
                placeholder="Estoque"
                style={{ width: 90, background: PALETTE.surface, border: "1px solid " + PALETTE.border, borderRadius: 8, color: PALETTE.text, padding: "6px 8px", fontSize: 13 }}
              />
              <button onClick={() => removeColor(idx)} style={{ background: "transparent", border: "none", color: PALETTE.danger, cursor: "pointer" }}>
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          <button
            onClick={addColor}
            style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "1px dashed " + PALETTE.border, color: PALETTE.muted, borderRadius: 8, padding: "6px 10px", fontSize: 12, cursor: "pointer", marginTop: 2 }}
          >
            <Plus size={13} /> Adicionar cor
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "space-between", marginTop: 4 }}>
        <button
          onClick={() => onDelete(form.id)}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "1px solid " + PALETTE.danger, color: PALETTE.danger, borderRadius: 8, padding: "8px 12px", fontSize: 13, cursor: "pointer" }}
        >
          <Trash2 size={14} /> Excluir produto
        </button>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{ background: "transparent", border: "1px solid " + PALETTE.border, color: PALETTE.text, borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer" }}>
            Cancelar
          </button>
          <button
            onClick={() => onSave(form)}
            style={{ display: "flex", alignItems: "center", gap: 6, background: PALETTE.gold, color: "#1A1204", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            <Check size={14} /> Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminPanel({ products, setProducts, whatsapp, setWhatsapp, onExit }) {
  const [pin, setPin] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [waDraft, setWaDraft] = useState(whatsapp);

  function saveProduct(updated) {
    setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setEditingId(null);
  }

  function deleteProduct(id) {
    if (!window.confirm("Excluir este produto definitivamente?")) return;
    setProducts((prev) => prev.filter((p) => p.id !== id));
    setEditingId(null);
  }

  function addProduct() {
    const blank = {
      id: uid(),
      name: "Novo produto",
      description: "Descrição do produto",
      price: 0,
      priceFrom: false,
      active: true,
      images: [LOGO_URI],
      colors: [{ name: "Padrão", hex: "#D9A44C", stock: 10 }],
    };
    setProducts((prev) => [blank, ...prev]);
    setEditingId(blank.id);
  }

  if (!unlocked) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 20 }}>
        <Lock size={28} color={PALETTE.gold} />
        <h2 style={{ margin: 0, fontFamily: "'Space Grotesk', sans-serif", color: PALETTE.text }}>Área do vendedor</h2>
        <p style={{ color: PALETTE.muted, fontSize: 13, textAlign: "center", maxWidth: 300 }}>Digite o PIN para acessar o painel de produtos.</p>
        <input
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && pin === ADMIN_PIN) setUnlocked(true);
          }}
          placeholder="PIN"
          style={{ background: PALETTE.surface, border: "1px solid " + PALETTE.border, borderRadius: 8, color: PALETTE.text, padding: "10px 14px", fontSize: 15, textAlign: "center", width: 140 }}
        />
        <button
          onClick={() => {
            if (pin === ADMIN_PIN) setUnlocked(true);
            else alert("PIN incorreto");
          }}
          style={{ background: PALETTE.gold, color: "#1A1204", border: "none", borderRadius: 8, padding: "10px 22px", fontWeight: 700, cursor: "pointer" }}
        >
          Entrar
        </button>
        <button onClick={onExit} style={{ background: "transparent", border: "none", color: PALETTE.muted, fontSize: 13, cursor: "pointer", marginTop: 4 }}>
          ← Voltar para a loja
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 20px 80px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: "'Space Grotesk', sans-serif", color: PALETTE.text, fontSize: 22 }}>Painel do vendedor</h2>
          <p style={{ margin: "4px 0 0", color: PALETTE.muted, fontSize: 13 }}>{products.length} produtos cadastrados</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={addProduct}
            style={{ display: "flex", alignItems: "center", gap: 6, background: PALETTE.gold, color: "#1A1204", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            <PackagePlus size={15} /> Novo produto
          </button>
          <button onClick={onExit} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "1px solid " + PALETTE.border, color: PALETTE.text, borderRadius: 8, padding: "9px 14px", fontSize: 13, cursor: "pointer" }}>
            <ChevronLeft size={15} /> Voltar para a loja
          </button>
        </div>
      </div>

      <div style={{ background: PALETTE.surface, border: "1px solid " + PALETTE.border, borderRadius: 12, padding: 16, marginBottom: 24, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <Settings size={16} color={PALETTE.gold} />
        <label style={{ fontSize: 13, color: PALETTE.muted }}>
          Número de WhatsApp para pedidos (com DDI+DDD, só números):
        </label>
        <input
          value={waDraft}
          onChange={(e) => setWaDraft(e.target.value.replace(/[^0-9]/g, ""))}
          style={{ background: PALETTE.surface2, border: "1px solid " + PALETTE.border, borderRadius: 8, color: PALETTE.text, padding: "7px 10px", fontSize: 13, width: 160 }}
        />
        <button
          onClick={() => setWhatsapp(waDraft)}
          style={{ background: "transparent", border: "1px solid " + PALETTE.gold, color: PALETTE.gold, borderRadius: 8, padding: "7px 14px", fontSize: 12, cursor: "pointer" }}
        >
          Salvar número
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {products.map((p) =>
          editingId === p.id ? (
            <AdminProductForm key={p.id} product={p} onSave={saveProduct} onCancel={() => setEditingId(null)} onDelete={deleteProduct} />
          ) : (
            <div
              key={p.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                background: PALETTE.surface,
                border: "1px solid " + PALETTE.border,
                borderRadius: 12,
                padding: 12,
                opacity: p.active ? 1 : 0.55,
              }}
            >
              <img src={p.images[0]} alt={p.name} style={{ width: 56, height: 56, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, color: PALETTE.text, fontWeight: 600 }}>{p.name}</div>
                <div style={{ fontSize: 12, color: PALETTE.muted, marginTop: 2 }}>
                  {(p.priceFrom ? "a partir de " : "") + formatBRL(p.price)} · {p.colors.reduce((s, c) => s + c.stock, 0)} un. em estoque · {p.active ? "ativo" : "inativo"}
                </div>
              </div>
              <button
                onClick={() => setEditingId(p.id)}
                style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "1px solid " + PALETTE.border, color: PALETTE.text, borderRadius: 8, padding: "7px 12px", fontSize: 12, cursor: "pointer" }}
              >
                <Pencil size={13} /> Editar
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
}

function Toast({ message }) {
  if (!message) return null;
  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        background: PALETTE.surface2,
        border: "1px solid " + PALETTE.gold,
        color: PALETTE.text,
        padding: "10px 18px",
        borderRadius: 10,
        fontSize: 13,
        zIndex: 60,
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
      }}
    >
      {message}
    </div>
  );
}

export default function App() {
  const [products, setProducts] = useState(INITIAL_PRODUCTS);
  const [whatsapp, setWhatsapp] = useState(DEFAULT_WHATSAPP);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("shop");
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [note, setNote] = useState("");
  const [toastMsg, setToastMsg] = useState("");
  const toastTimer = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.from("moldeq_catalog").select("data").eq("id", STORAGE_KEY).maybeSingle();
        if (error) throw error;
        if (data && data.data) {
          setProducts(data.data.products || INITIAL_PRODUCTS);
          setWhatsapp(data.data.whatsapp || DEFAULT_WHATSAPP);
        } else {
          await supabase.from("moldeq_catalog").upsert({ id: STORAGE_KEY, data: { products: INITIAL_PRODUCTS, whatsapp: DEFAULT_WHATSAPP } });
        }
      } catch (e) {
        console.error("Erro ao carregar catálogo do Supabase:", e);
        // fica com os valores padrão já definidos no estado
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (loading) return;
    (async () => {
      try {
        const { error } = await supabase
          .from("moldeq_catalog")
          .upsert({ id: STORAGE_KEY, data: { products, whatsapp }, updated_at: new Date().toISOString() });
        if (error) throw error;
      } catch (e) {
        console.error("Erro ao salvar catálogo no Supabase:", e);
      }
    })();
  }, [products, whatsapp, loading]);

  function showToast(msg) {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(""), 2200);
  }

  function addToCart(productId, colorName, qty) {
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.productId === productId && i.colorName === colorName);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + qty };
        return next;
      }
      return [...prev, { productId, colorName, qty }];
    });
    setCartOpen(true);
  }

  function removeFromCart(idx) {
    setCart((prev) => prev.filter((_, i) => i !== idx));
  }

  function changeQty(idx, delta) {
    setCart((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], qty: Math.max(1, next[idx].qty + delta) };
      return next;
    });
  }

  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  const visibleProducts = useMemo(() => {
    return products.filter((p) => p.active && p.name.toLowerCase().includes(search.toLowerCase()));
  }, [products, search]);

  const fontImport = (
    <style>{"@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');"}</style>
  );

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: PALETTE.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {fontImport}
        <span style={{ color: PALETTE.muted, fontFamily: "Inter, sans-serif" }}>Carregando catálogo…</span>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: PALETTE.bg, fontFamily: "'Inter', sans-serif", color: PALETTE.text }}>
      {fontImport}

      <header style={{ borderBottom: "1px solid " + PALETTE.border, position: "sticky", top: 0, background: "rgba(20,22,28,0.92)", backdropFilter: "blur(6px)", zIndex: 30 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setView("shop")}>
            <img src={LOGO_URI} alt="Moldeq" style={{ height: 34, borderRadius: 6 }} />
          </div>
          {view === "shop" && (
            <div style={{ flex: 1, maxWidth: 320, position: "relative" }}>
              <Search size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: PALETTE.muted }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar produto..."
                style={{
                  width: "100%",
                  background: PALETTE.surface,
                  border: "1px solid " + PALETTE.border,
                  borderRadius: 999,
                  color: PALETTE.text,
                  padding: "8px 12px 8px 32px",
                  fontSize: 13,
                  boxSizing: "border-box",
                }}
              />
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {view === "shop" ? (
              <button
                onClick={() => setView("admin")}
                title="Área do vendedor"
                style={{ background: "transparent", border: "1px solid " + PALETTE.border, borderRadius: 8, padding: "8px 10px", color: PALETTE.muted, cursor: "pointer", display: "flex", alignItems: "center" }}
              >
                <Lock size={15} />
              </button>
            ) : null}
            {view === "shop" && (
              <button
                onClick={() => setCartOpen(true)}
                style={{
                  position: "relative",
                  background: PALETTE.gold,
                  border: "none",
                  borderRadius: 8,
                  padding: "9px 12px",
                  color: "#1A1204",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                <ShoppingCart size={16} />
                {cartCount > 0 && (
                  <span style={{ background: "#1A1204", color: PALETTE.goldBright, borderRadius: 999, fontSize: 11, padding: "1px 6px" }}>{cartCount}</span>
                )}
              </button>
            )}
          </div>
        </div>
      </header>

      {view === "shop" ? (
        <>
          <section style={{ maxWidth: 1100, margin: "0 auto", padding: "56px 20px 30px", textAlign: "center" }}>
            <div style={{ fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: PALETTE.gold, marginBottom: 14 }}>
              Impressão 3D sob encomenda
            </div>
            <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(28px, 5vw, 46px)", margin: "0 0 14px", lineHeight: 1.15 }}>
              Peças impressas, camada
              <br />
              por camada, do seu jeito.
            </h1>
            <p style={{ color: PALETTE.muted, maxWidth: 520, margin: "0 auto", fontSize: 15, lineHeight: 1.6 }}>
              Escolha o modelo, a cor e a quantidade. Seu pedido vai direto para o WhatsApp — sem burocracia, sem cadastro.
            </p>
          </section>

          <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 20px" }}>
            <LayerLines height={22} opacity={0.55} />
          </div>

          <main style={{ maxWidth: 1100, margin: "0 auto", padding: "36px 20px 100px" }}>
            {visibleProducts.length === 0 ? (
              <p style={{ textAlign: "center", color: PALETTE.muted, marginTop: 60 }}>Nenhum produto encontrado para "{search}".</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 18 }}>
                {visibleProducts.map((p) => (
                  <ProductCard key={p.id} product={p} onAddToCart={addToCart} toast={showToast} />
                ))}
              </div>
            )}
          </main>

          <footer style={{ borderTop: "1px solid " + PALETTE.border, padding: "28px 20px", textAlign: "center", color: PALETTE.muted, fontSize: 12 }}>
            Moldeq · Catálogo oficial de produtos 3D · Pedidos via WhatsApp
          </footer>

          <CartDrawer
            open={cartOpen}
            onClose={() => setCartOpen(false)}
            cart={cart}
            products={products}
            onRemove={removeFromCart}
            onQtyChange={changeQty}
            whatsapp={whatsapp}
            note={note}
            setNote={setNote}
            onSent={() => {
              showToast("Pedido aberto no WhatsApp!");
            }}
          />

          {!cartOpen && (
            <button
              onClick={() => setCartOpen(true)}
              style={{
                position: "fixed",
                bottom: 22,
                right: 22,
                background: "linear-gradient(135deg," + PALETTE.gold + "," + PALETTE.goldBright + ")",
                border: "none",
                borderRadius: 999,
                width: 56,
                height: 56,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                zIndex: 20,
              }}
            >
              <ShoppingCart size={22} color="#1A1204" />
              {cartCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: -4,
                    right: -4,
                    background: PALETTE.purpleDeep,
                    color: "#fff",
                    borderRadius: 999,
                    fontSize: 11,
                    padding: "2px 6px",
                    fontWeight: 700,
                  }}
                >
                  {cartCount}
                </span>
              )}
            </button>
          )}
        </>
      ) : (
        <AdminPanel products={products} setProducts={setProducts} whatsapp={whatsapp} setWhatsapp={setWhatsapp} onExit={() => setView("shop")} />
      )}

      <Toast message={toastMsg} />
    </div>
  );
}
