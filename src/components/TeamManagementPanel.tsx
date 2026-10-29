import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { GlowCard } from './GlowCard';
import { api } from '../services/api';

type TeamRole = 'MANAGER' | 'RECEPTION' | 'TRAINER';
type TeamMember = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  roleName?: string | null;
  accountActive?: boolean;
  membershipActive?: boolean;
  permissions?: string[];
  canManage?: boolean;
};
const roleLabel: Record<TeamRole, string> = {
  MANAGER: 'Gerente', RECEPTION: 'Recepção', TRAINER: 'Treinador',
};
const sensitiveAreas = 'Financeiro, assinatura IRON, integrações, configurações administrativas e dados sensíveis exigem permissões próprias e, quando aplicável, autenticação reforçada.';

function Action({ label, onPress, testID, disabled = false, secondary = false }: {
  label: string; onPress: () => void; testID?: string; disabled?: boolean; secondary?: boolean;
}) {
  return <TouchableOpacity accessibilityRole="button" testID={testID} disabled={disabled}
    onPress={onPress} style={[styles.action, secondary && styles.secondary, disabled && styles.disabled]}>
    <Text style={styles.actionText}>{label}</Text>
  </TouchableOpacity>;
}
function Field({ label, value, onChangeText, testID }: {
  label: string; value: string; onChangeText: (v: string) => void; testID?: string;
}) {
  return <View style={styles.field}>
    <Text style={styles.muted}>{label}</Text>
    <TextInput testID={testID} value={value} onChangeText={onChangeText}
      style={styles.input} placeholderTextColor="#64748b" />
  </View>;
}

export function TeamManagementPanel({ members, actorRoles, rosterLoaded = true, onUpdated }: {
  members: TeamMember[];
  actorRoles: string[];
  rosterLoaded?: boolean;
  onUpdated: () => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [inviteRole, setInviteRole] = useState<TeamRole>('TRAINER');
  const [selectedRole, setSelectedRole] = useState<Record<string, TeamRole>>({});
  const [pending, setPending] = useState<{ id: string; kind: 'status' | 'role'; next?: boolean } | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const isOwner = actorRoles.includes('OWNER') || actorRoles.includes('SUPER_ADMIN');
  const isManager = actorRoles.includes('MANAGER') && !isOwner;
  const allowedRoles: TeamRole[] = isOwner ? ['MANAGER', 'RECEPTION', 'TRAINER'] : isManager ? ['RECEPTION', 'TRAINER'] : [];

  async function perform(action: () => Promise<unknown>, success: string, reset?: () => void) {
    if (working || !rosterLoaded || allowedRoles.length === 0) return;
    setWorking(true); setError(''); setNotice('');
    try {
      await action();
      reset?.();
      await onUpdated();
      setNotice(success);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível concluir a operação.');
    } finally {
      setWorking(false);
    }
  }

  const inviteValid = allowedRoles.length > 0 && name.trim().length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    && allowedRoles.includes(inviteRole);
  return <View>
    {error ? <Text style={styles.error} testID="team-error">{error}</Text> : null}
    {notice ? <Text style={styles.success} testID="team-notice">{notice}</Text> : null}
    <GlowCard style={styles.block}>
      <Text style={styles.heading}>Convidar membro da academia</Text>
      <Text style={styles.muted}>O colaborador define a própria senha pelo fluxo de recuperação enviado por e-mail. A interface não cria senhas compartilhadas.</Text>
      <View style={styles.form}>
        <Field label="Nome" testID="team-invite-name" value={name} onChangeText={setName} />
        <Field label="E-mail" testID="team-invite-email" value={email} onChangeText={setEmail} />
        <Field label="Telefone (opcional)" value={phone} onChangeText={setPhone} />
      </View>
      <Text style={styles.label}>Função do convite</Text>
      <View style={styles.actions}>
        {allowedRoles.map((role) => <Action key={role} testID={`team-invite-role-${role}`}
          label={`${roleLabel[role]}${inviteRole === role ? ' ✓' : ''}`}
          onPress={() => setInviteRole(role)} secondary={inviteRole !== role} />)}
      </View>
      <Action label={working ? 'Enviando…' : 'Enviar convite'}
        testID="team-invite-submit" disabled={!rosterLoaded || !inviteValid || working}
        onPress={() => { void perform(() => api('/users/invite', undefined, {
          method: 'POST', body: JSON.stringify({
            name: name.trim(), email: email.trim().toLowerCase(), roleName: inviteRole,
            ...(phone.trim() ? { phone: phone.trim() } : {}),
          }),
        }), 'Convite solicitado. O recebimento do e-mail depende do serviço de entrega.',
        () => { setName(''); setEmail(''); setPhone(''); setInviteRole('TRAINER'); }); }} />
    </GlowCard>

    <GlowCard style={styles.block}>
      <Text style={styles.heading}>Equipe e permissões efetivas</Text>
      <Text style={styles.muted}>Dados da API de membros da academia. As operações são conferidas novamente pelo backend, independentemente dos botões visíveis.</Text>
      {isManager ? <Text style={styles.muted}>Como gerente, você administra apenas os vínculos de recepção e treinador que a API disponibiliza.</Text> : null}
      {members.length === 0 ? <Text style={styles.muted}>Nenhum membro encontrado.</Text> : members.map((member) => {
        const role = member.roleName as TeamRole | undefined;
        const desiredRole = selectedRole[member.id] ?? (allowedRoles.includes(role as TeamRole) ? role as TeamRole : 'TRAINER');
        const manageable = (isOwner || isManager) && member.canManage === true && member.accountActive !== false &&
          (role === 'MANAGER' || role === 'RECEPTION' || role === 'TRAINER') && (!isManager || role !== 'MANAGER');
        const active = member.membershipActive === true;
        return <View key={member.id} style={styles.entry}>
          <Text style={styles.memberName}>{member.name}</Text>
          <Text style={styles.muted}>{member.email} · {role && role in roleLabel ? roleLabel[role] : 'Papel não editável'}</Text>
          <Text style={active ? styles.success : styles.warning}>
            Vínculo: {active ? 'Ativo' : 'Desativado'} · Conta: {member.accountActive !== false ? 'Ativa' : 'Inativa'}
          </Text>
          <Text style={styles.label}>Permissões efetivas informadas pelo servidor</Text>
          {member.permissions?.length ? <View style={styles.tags}>
            {member.permissions.map((permission) => <Text key={permission} style={styles.tag}>{permission}</Text>)}
          </View> : <Text style={styles.muted}>Nenhuma permissão retornada.</Text>}
          {manageable ? <>
            <View style={styles.actions}>
              {allowedRoles.map((candidate) => <Action key={candidate}
                testID={`team-role-choice-${member.id}-${candidate}`}
                label={`${roleLabel[candidate]}${candidate === desiredRole ? ' ✓' : ''}`}
                secondary={desiredRole !== candidate}
                onPress={() => { setSelectedRole((current) => ({ ...current, [member.id]: candidate })); setPending(null); }} />)}
            </View>
            {pending?.id === member.id && pending.kind === 'role'
              ? <View style={styles.actions}><Text style={styles.warning}>Confirmar alteração para {roleLabel[desiredRole]}?</Text>
                <Action testID={`team-role-confirm-${member.id}`} label="Confirmar função" disabled={working || !rosterLoaded}
                  onPress={() => { void perform(() => api(`/users/${member.id}/membership/role`, undefined, {
                    method: 'PATCH', body: JSON.stringify({ roleName: desiredRole }),
                  }), 'Função atualizada.', () => setPending(null)); }} />
                <Action label="Cancelar" secondary onPress={() => setPending(null)} />
              </View>
              : <Action testID={`team-role-save-${member.id}`} label="Alterar função"
                disabled={working || !rosterLoaded || desiredRole === role} onPress={() => setPending({ id: member.id, kind: 'role' })} />}
            {pending?.id === member.id && pending.kind === 'status'
              ? <View style={styles.actions}>
                <Text style={styles.warning}>Confirmar {active ? 'desativação' : 'reativação'} deste vínculo? {active ? 'Sessões de atualização serão revogadas pelo servidor.' : ''}</Text>
                <Action testID={`team-status-confirm-${member.id}`} label="Confirmar alteração" disabled={working || !rosterLoaded}
                  onPress={() => { void perform(() => api(`/users/${member.id}/membership/status`, undefined, {
                    method: 'PATCH', body: JSON.stringify({ active: !active }),
                  }), 'Estado do vínculo atualizado.', () => setPending(null)); }} />
                <Action label="Cancelar" secondary onPress={() => setPending(null)} />
              </View>
              : <Action testID={`team-status-toggle-${member.id}`} label={active ? 'Desativar acesso' : 'Reativar acesso'}
                  disabled={working || !rosterLoaded} onPress={() => setPending({ id: member.id, kind: 'status', next: !active })} />}
          </> : <Text style={styles.muted}>Este membro está fora do seu escopo de gerenciamento ou a conta não está ativa.</Text>}
        </View>;
      })}
    </GlowCard>
    <GlowCard style={styles.block}>
      <Text style={styles.heading}>Limites de acesso</Text>
      <Text style={styles.muted}>{sensitiveAreas}</Text>
      <Text style={styles.muted}>Os nomes acima são permissões efetivas retornadas pelo backend. Acesso efetivo também exige academia ativa, entitlement e eventual step-up.</Text>
    </GlowCard>
  </View>;
}

const styles = StyleSheet.create({
  block: { padding: 16, marginBottom: 12, gap: 9 },
  heading: { color: '#2BF47A', fontSize: 17, fontWeight: '800' },
  label: { color: '#e2e8f0', fontSize: 12, fontWeight: '700' },
  muted: { color: '#94a3b8', fontSize: 12, lineHeight: 18 },
  form: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  field: { minWidth: 180, flexGrow: 1, flexBasis: 200, gap: 4 },
  input: { padding: 10, borderRadius: 8, backgroundColor: '#0b1120', borderWidth: 1, borderColor: '#334155', color: '#f8fafc' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  action: { alignSelf: 'flex-start', backgroundColor: '#123524', borderWidth: 1, borderColor: '#2BF47A', padding: 9, borderRadius: 9 },
  secondary: { backgroundColor: '#172033', borderColor: '#334155' },
  actionText: { color: '#b5fccc', fontSize: 12, fontWeight: '700' },
  disabled: { opacity: 0.45 },
  memberName: { color: '#f8fafc', fontSize: 15, fontWeight: '800' },
  entry: { borderTopWidth: 1, borderTopColor: '#273248', paddingVertical: 11, gap: 8 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { fontSize: 11, color: '#dbeafe', backgroundColor: '#1e293b', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 4 },
  success: { fontSize: 12, color: '#2BF47A' },
  error: { fontSize: 12, color: '#fca5a5' },
  warning: { fontSize: 12, color: '#fde68a' },
});
