import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthProvider";

import {
  watchCompany,
  saveCompany,
  watchUserProfiles,
  watchUserProfile,
  setUserRole,
  setUserActive,
  saveUserProfile,
  updateSelfProfile,
  uploadCompanyLogo,
  uploadUserAvatar,
  gsToHttps,
} from "../../config/services/orgService";

import type {
  CompanyInfo,
  UserProfile,
  UserRole,
} from "../../config/services/orgService";

import { Building2, UserCog, User as UserIcon, Upload, Plus } from "lucide-react";

/* Firebase (convites) */
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../../firebase/config";

/* Helpers */
const ROLES: UserRole[] = ["admin", "finance", "sales", "viewer"];
const roleLabel: Record<UserRole, string> = {
  admin: "Administrador",
  finance: "Financeiro",
  sales: "Vendas",
  viewer: "Leitor",
};

type Tab = "perfil" | "empresa" | "usuarios";

export default function Organizacao() {
  const { user } = useAuth();

  const [tab, setTab] = useState<Tab>("perfil");

  /* ---------- Empresa ---------- */
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [cName, setCName] = useState("");
  const [cCnpj, setCCnpj] = useState("");
  const [cAddr, setCAddr] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [cWhats, setCWhats] = useState("");
  const [cLogo, setCLogo] = useState("");
  const [savingCompany, setSavingCompany] = useState(false);
  const [okCompany, setOkCompany] = useState(false);

  /* ---------- Usuários ---------- */
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "">("");

  /* Formulário de convite */
  const [showInvite, setShowInvite] = useState(false);
  const [invName, setInvName] = useState("");
  const [invEmail, setInvEmail] = useState("");
  const [invRole, setInvRole] = useState<UserRole>("viewer");
  const [savingInvite, setSavingInvite] = useState(false);
  const [okInvite, setOkInvite] = useState(false);
  const [errInvite, setErrInvite] = useState<string>("");

  /* ---------- Meu Perfil ---------- */
  const [me, setMe] = useState<UserProfile | null>(null);
  const [pName, setPName] = useState("");
  const [pEmail, setPEmail] = useState("");
  const [pPhoto, setPPhoto] = useState<string>("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [okProfile, setOkProfile] = useState(false);

  useEffect(() => {
    const offA = watchCompany((c) => {
      setCompany(c);
      setCName(c.name || "");
      setCCnpj(c.cnpj || "");
      setCAddr(c.address || "");
      setCEmail(c.email || "");
      setCWhats(c.whatsapp || "");
      setCLogo(c.logoUrl || "");
    });

    const offB = watchUserProfiles(setUsers);

    let offC: undefined | (() => void);
    if (user?.uid) {
      offC = watchUserProfile(user.uid, (p) => {
        setMe(p);
        setPName(p?.name || "");
        setPEmail(p?.email || user.email || "");
        setPPhoto(p?.photoUrl || "");
      });
    }

    return () => {
      offA();
      offB();
      offC && offC();
    };
  }, [user?.uid, user?.email]);

  const filtered = useMemo(() => {
    let rows = users;
    if (roleFilter) rows = rows.filter((r) => r.role === roleFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      // 🔒 Busca somente por nome/e-mail (sem UID)
      rows = rows.filter((r) =>
        [r.name, r.email].some((v) => (v || "").toLowerCase().includes(q))
      );
    }
    return rows;
  }, [users, roleFilter, query]);

  const saveCompanyForm = async () => {
    setSavingCompany(true);
    await saveCompany({
      name: cName.trim(),
      cnpj: cCnpj.trim(),
      address: cAddr.trim(),
      email: cEmail.trim(),
      whatsapp: cWhats.trim(),
      logoUrl: cLogo.trim(),
    });
    setSavingCompany(false);
    setOkCompany(true);
    setTimeout(() => setOkCompany(false), 1800);
  };

  const onUploadCompanyLogo = async (file: File) => {
    const { gsUrl } = await uploadCompanyLogo(file);
    await saveCompany({ logoUrl: gsUrl });
    setCLogo(gsUrl);
  };

  const onUploadAvatar = async (file: File) => {
    const { httpsUrl } = await uploadUserAvatar(file);
    setPPhoto(httpsUrl);
    await updateSelfProfile({ photoUrl: httpsUrl });
  };

  const saveMyProfile = async () => {
    setSavingProfile(true);
    try {
      await updateSelfProfile({ name: pName });
      setOkProfile(true);
      setTimeout(() => setOkProfile(false), 1600);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleInvite = async () => {
    setErrInvite("");
    const email = invEmail.trim().toLowerCase();
    const name = invName.trim();
    if (!email) {
      setErrInvite("Informe um e-mail válido.");
      return;
    }
    setSavingInvite(true);
    try {
      await setDoc(
        doc(db, "orgInvites", email),
        {
          email,
          name,
          role: invRole,
          active: true,
          createdAt: serverTimestamp(),
          createdByUid: me?.uid || user?.uid || null,
        },
        { merge: true }
      );
      setOkInvite(true);
      setInvEmail("");
      setInvName("");
      setInvRole("viewer");
      setShowInvite(false);
      setTimeout(() => setOkInvite(false), 1800);
    } catch (e: any) {
      setErrInvite(e?.message || "Falha ao criar convite.");
    } finally {
      setSavingInvite(false);
    }
  };

  if (!company) return <div>Carregando…</div>;

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <header className="flex flex-wrap items-center gap-3 p-4 bg-white rounded-lg border">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-indigo-600" />
          <h1 className="text-lg font-semibold">Organização</h1>
        </div>

        {/* Tabs */}
        <nav className="ml-auto flex gap-1">
          <button
            className={`px-3 py-1.5 text-sm rounded-md border ${
              tab === "perfil" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white"
            }`}
            onClick={() => setTab("perfil")}
          >
            Meu perfil
          </button>
          <button
            className={`px-3 py-1.5 text-sm rounded-md border ${
              tab === "empresa" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white"
            }`}
            onClick={() => setTab("empresa")}
          >
            Empresa
          </button>
          <button
            className={`px-3 py-1.5 text-sm rounded-md border ${
              tab === "usuarios" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white"
            }`}
            onClick={() => setTab("usuarios")}
          >
            Usuários
          </button>
        </nav>
      </header>

      {/* MEU PERFIL */}
      {tab === "perfil" && (
        <section className="p-4 bg-white border rounded-lg space-y-4">
          <div className="flex items-center gap-2">
            <UserIcon className="w-4 h-4 text-slate-600" />
            <h2 className="text-base font-semibold">Meu Perfil</h2>
            {me?.role && (
              <span className="ml-2 text-xs px-2 py-0.5 rounded-full border bg-slate-50">
                Papel: {roleLabel[me.role]}
              </span>
            )}
          </div>

          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex items-center gap-3">
              {pPhoto ? (
                <img
                  src={pPhoto}
                  alt="Avatar"
                  className="w-16 h-16 rounded-full object-cover border"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-slate-200 border" />
              )}

              <label className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-md border cursor-pointer bg-white hover:bg-gray-50">
                <Upload className="w-4 h-4" />
                Trocar foto
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) await onUploadAvatar(f);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
              <div>
                <label className="text-sm">Nome</label>
                <input
                  className="w-full mt-1 p-2 border rounded"
                  value={pName}
                  onChange={(e) => setPName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm">E-mail</label>
                <input
                  className="w-full mt-1 p-2 border rounded bg-slate-50"
                  value={pEmail}
                  disabled
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              className="px-3 py-2 text-sm rounded-md bg-indigo-600 text-white disabled:opacity-50"
              onClick={saveMyProfile}
              disabled={savingProfile}
            >
              {savingProfile ? "Salvando…" : "Salvar perfil"}
            </button>
            {okProfile && <span className="text-green-600 text-sm">Salvo!</span>}
          </div>
        </section>
      )}

      {/* DADOS DA EMPRESA */}
      {tab === "empresa" && (
        <section className="p-4 bg-white border rounded-lg space-y-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-600" />
            <h2 className="text-base font-semibold">Dados da Empresa</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm">Nome / Razão Social</label>
              <input
                className="w-full mt-1 p-2 border rounded"
                value={cName}
                onChange={(e) => setCName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm">CNPJ</label>
              <input
                className="w-full mt-1 p-2 border rounded"
                value={cCnpj}
                onChange={(e) => setCCnpj(e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm">Endereço</label>
              <input
                className="w-full mt-1 p-2 border rounded"
                value={cAddr}
                onChange={(e) => setCAddr(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm">E-mail</label>
              <input
                className="w-full mt-1 p-2 border rounded"
                value={cEmail}
                onChange={(e) => setCEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm">WhatsApp</label>
              <input
                className="w-full mt-1 p-2 border rounded"
                value={cWhats}
                onChange={(e) => setCWhats(e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm">Logotipo</label>
              <div className="mt-1 flex items-center gap-3">
                {cLogo ? (
                  <img
                    src={gsToHttps(cLogo)}
                    alt="Logo"
                    className="h-8"
                    onError={(e) =>
                      ((e.currentTarget as HTMLImageElement).style.display = "none")
                    }
                  />
                ) : (
                  <span className="text-xs text-slate-400">—</span>
                )}
                <label className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-md border cursor-pointer bg-white hover:bg-gray-50">
                  <Upload className="w-4 h-4" />
                  Enviar logotipo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (f) await onUploadCompanyLogo(f);
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              className="px-3 py-2 text-sm rounded-md bg-indigo-600 text-white disabled:opacity-50"
              onClick={saveCompanyForm}
              disabled={savingCompany}
            >
              {savingCompany ? "Salvando…" : "Salvar dados da empresa"}
            </button>
            {okCompany && <span className="text-green-600 text-sm">Salvo!</span>}
          </div>
        </section>
      )}

      {/* USUÁRIOS */}
      {tab === "usuarios" && (
        <section className="p-4 bg-white border rounded-lg space-y-4">
          <div className="flex items-center gap-2">
            <UserCog className="w-4 h-4 text-slate-600" />
            <h2 className="text-base font-semibold">Perfis de Usuários</h2>

            {me?.role === "admin" && (
              <button
                className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md bg-indigo-600 text-white disabled:opacity-50"
                onClick={() => setShowInvite((v) => !v)}
                title="Criar convite para novo usuário"
              >
                <Plus className="w-4 h-4" /> Adicionar usuário
              </button>
            )}
          </div>

          {showInvite && me?.role === "admin" && (
            <div className="p-3 border rounded-md bg-slate-50/50 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-sm">Nome</label>
                  <input
                    className="w-full mt-1 p-2 border rounded"
                    value={invName}
                    onChange={(e) => setInvName(e.target.value)}
                    placeholder="Opcional"
                  />
                </div>
                <div>
                  <label className="text-sm">E-mail</label>
                  <input
                    className="w-full mt-1 p-2 border rounded"
                    value={invEmail}
                    onChange={(e) => setInvEmail(e.target.value)}
                    placeholder="usuario@dominio.com"
                  />
                </div>
                <div>
                  <label className="text-sm">Papel</label>
                  <select
                    className="w-full mt-1 p-2 border rounded"
                    value={invRole}
                    onChange={(e) => setInvRole(e.target.value as UserRole)}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {roleLabel[r]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  className="px-3 py-2 text-sm rounded-md bg-indigo-600 text-white disabled:opacity-50"
                  onClick={handleInvite}
                  disabled={savingInvite}
                >
                  {savingInvite ? "Enviando convite…" : "Criar convite"}
                </button>
                <button
                  className="px-3 py-2 text-sm rounded-md border"
                  onClick={() => setShowInvite(false)}
                  disabled={savingInvite}
                >
                  Cancelar
                </button>
                {okInvite && (
                  <span className="text-green-600 text-sm">Convite criado!</span>
                )}
                {errInvite && (
                  <span className="text-red-600 text-sm">{errInvite}</span>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <input
              className="px-3 py-2 border rounded text-sm"
              placeholder="Buscar por nome ou e-mail…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              className="px-2 py-2 border rounded text-sm"
              value={roleFilter}
              onChange={(e) => setRoleFilter((e.target.value as UserRole) || "")}
            >
              <option value="">Todos os papéis</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {roleLabel[r]}
                </option>
              ))}
            </select>
            <div className="ml-auto text-xs text-slate-500">
              Total: {filtered.length} {filtered.length === 1 ? "usuário" : "usuários"}
            </div>
          </div>

          <div className="rounded border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="p-2">Usuário</th>
                  <th className="p-2">E-mail</th>
                  <th className="p-2">Papel</th>
                  <th className="p-2">Status</th>
                  <th className="p-2 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((u) => (
                  <tr key={u.uid} className="align-middle">
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        {u.photoUrl ? (
                          <img src={u.photoUrl} alt="" className="w-6 h-6 rounded-full" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-slate-200" />
                        )}
                        <div className="min-w-0">
                          <div
                            className="font-medium truncate max-w-[220px]"
                            title={u.name || ""}
                          >
                            {u.name || "—"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-2">{u.email || "—"}</td>
                    <td className="p-2">
                      <select
                        className="px-2 py-1 border rounded text-xs"
                        value={u.role}
                        onChange={async (e) => {
                          const role = e.target.value as UserRole;
                          setUsers((rows) =>
                            rows.map((r) => (r.uid === u.uid ? { ...r, role } : r))
                          );
                          try {
                            await setUserRole(u.uid, role);
                          } catch {}
                        }}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {roleLabel[r]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2">
                      <label className="inline-flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={!!u.active}
                          onChange={async (e) => {
                            const active = e.target.checked;
                            setUsers((rows) =>
                              rows.map((r) =>
                                r.uid === u.uid ? { ...r, active } : r
                              )
                            );
                            try {
                              await setUserActive(u.uid, active);
                            } catch {}
                          }}
                        />
                        {u.active ? "Ativo" : "Suspenso"}
                      </label>
                    </td>
                    <td className="p-2 text-right">
                      <button
                        className="px-2 py-1 text-xs rounded border"
                        onClick={async () => {
                          const name =
                            prompt("Novo nome para o usuário:", u.name ?? "") ?? u.name;
                          if (name !== u.name) {
                            setUsers((rows) =>
                              rows.map((r) =>
                                r.uid === u.uid ? { ...r, name } : r
                              )
                            );
                            try {
                              await saveUserProfile(u.uid, { name });
                            } catch {}
                          }
                        }}
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}

                {!filtered.length && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-500">
                      Nenhum usuário encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-slate-500">
            Observação: esta lista mostra perfis na coleção <code>userProfiles</code>.{" "}
            Use o botão acima para criar um convite em <code>orgInvites</code>.
          </p>
        </section>
      )}
    </div>
  );
}
