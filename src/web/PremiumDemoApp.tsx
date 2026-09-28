import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';

const items = [
  ['overview','Visão geral','grid-outline'],['students','Alunos','people-outline'],['team','Equipe','shield-checkmark-outline'],
  ['equipment','Equipamentos','barbell-outline'],['workouts','Treinos','clipboard-outline'],['schedule','Agenda','calendar-outline'],
  ['access','Acessos','key-outline'],['financial','Financeiro','wallet-outline'],['security','Segurança','shield-checkmark-outline'],
  ['integrations','Integrações','git-network-outline']
] as const;
const demo:any = {
 overview:{title:'Visão geral',lead:'A operação da academia em um único painel.',stats:[['248','Alunos ativos'],['87','Check-ins hoje'],['R$ 42,8 mil','Receita no mês'],['94%','Adimplência']]},
 students:{title:'Alunos',lead:'Relacionamento, jornada e situação de cada aluno.',stats:[['248','Ativos'],['18','Novos no mês'],['12','Aniversariantes'],['8','Pendências']]},
 team:{title:'Equipe',lead:'Profissionais, papéis e acesso à operação.',stats:[['14','Profissionais'],['9','Treinadores'],['3','Recepção'],['2','Gestores']]},
 equipment:{title:'Equipamentos',lead:'Inventário conectado aos exercícios e treinos.',stats:[['126','Equipamentos'],['118','Disponíveis'],['5','Manutenção'],['3','Indisponíveis']]},
 workouts:{title:'Treinos',lead:'Prescrição e acompanhamento no contexto do aluno.',stats:[['186','Treinos ativos'],['42','Atualizados'],['31','Avaliações'],['96%','Acompanhados']]},
 schedule:{title:'Agenda',lead:'Horários, reservas e presença em tempo real.',stats:[['34','Aulas hoje'],['286','Reservas'],['87','Check-ins'],['92%','Ocupação']]},
 access:{title:'Acessos',lead:'Entrada e presença conectadas à academia.',stats:[['87','Entradas hoje'],['4','Alertas'],['99,7%','Disponibilidade'],['2','Credenciais novas']]},
 financial:{title:'Financeiro',lead:'Receita, cobranças e pendências da operação.',stats:[['R$ 42,8 mil','Receita mensal'],['R$ 3,2 mil','A receber'],['94%','Adimplência'],['R$ 8,6 mil','Previsto 7 dias']]},
 security:{title:'Segurança',lead:'Proteções da conta e operações sensíveis.',stats:[['Ativo','MFA disponível'],['Protegido','Step-up'],['Ativo','Sessão segura'],['0','Alertas críticos']]},
 integrations:{title:'Integrações',lead:'Conectores da academia em um ambiente governado.',stats:[['4','Disponíveis'],['2','Conectadas'],['0','Falhas'],['Seguro','Segredos']]}
};
export function PremiumDemoApp(){
 const {width}=useWindowDimensions(); const mobile=width<760; const [active,setActive]=useState('overview'); const page=useMemo(()=>demo[active],[active]);
 return <View style={s.app}>
  <View style={[s.top,mobile&&s.topMobile]}><View><View style={s.brandLine}><Text style={s.brand}>IRON FIT</Text><Text style={s.core}>CORE</Text></View><Text style={s.tag}>Inteligência no centro. Evolução em movimento.</Text><Text style={s.by}>BY FM TECNOLOGIA</Text></View><View style={s.demo}><View style={s.dot}/><Text style={s.demoText}>DEMONSTRAÇÃO</Text></View></View>
  <View style={[s.shell,mobile&&s.shellMobile]}>
   <View style={[s.navFrame,mobile&&s.navFrameMobile]}>
    <ScrollView horizontal={mobile} style={[s.nav,mobile&&s.navMobile]} contentContainerStyle={mobile?s.navRow:undefined} showsHorizontalScrollIndicator={false}>
     {items.map(([key,label,icon])=><TouchableOpacity key={key} onPress={()=>setActive(key)} style={[s.navItem,active===key&&s.active]}><Ionicons name={icon} size={19} color={active===key?'#67d6ff':'#8295aa'}/><Text style={[s.navText,active===key&&s.navTextActive]}>{label}</Text></TouchableOpacity>)}
    </ScrollView>
   </View>
   <ScrollView style={s.content} contentContainerStyle={[s.inner,mobile&&s.innerMobile]}>
    <View style={s.eyebrowRow}><Text style={s.eyebrow}>IRON ACADEMIA DEMO</Text><Text style={s.status}>● OPERAÇÃO ONLINE</Text></View>
    <Text style={[s.title,mobile&&s.titleMobile]}>{page.title}</Text><Text style={s.lead}>{page.lead}</Text>
    <View style={[s.stats,mobile&&s.statsMobile]}>{page.stats.map((x:any)=><View key={x[1]} style={s.stat}><Text style={s.statValue}>{x[0]}</Text><Text style={s.statLabel}>{x[1]}</Text><View style={s.spark}/></View>)}</View>
    <View style={[s.grid,mobile&&s.gridMobile]}><View style={s.card}><View style={s.cardHead}><View><Text style={s.cardEyebrow}>VISÃO OPERACIONAL</Text><Text style={s.cardTitle}>Resumo do dia</Text></View><Ionicons name="pulse-outline" size={24} color="#2f91ff"/></View>
      {['Fluxo de alunos dentro do esperado','Agenda com boa ocupação','Nenhum incidente crítico','Financeiro atualizado'].map((x,i)=><View key={x} style={s.line}><View style={[s.lineIcon,i===3&&s.lineIconBlue]}><Ionicons name={i===3?'wallet-outline':'checkmark'} size={15} color={i===3?'#67d6ff':'#9ee37d'}/></View><Text style={s.lineText}>{x}</Text><Text style={s.lineMeta}>{i===0?'Agora':i===1?'Hoje':i===2?'24h':'Atual'}</Text></View>)}
    </View><View style={s.card}><Text style={s.cardEyebrow}>CORE INTELLIGENCE</Text><Text style={s.cardTitle}>Leitura inteligente da operação</Text><Text style={s.cardText}>A academia opera dentro do padrão esperado. A ocupação da agenda está alta e a adimplência permanece saudável. Nenhuma ação crítica é necessária neste momento.</Text><View style={s.aiPill}><Ionicons name="sparkles-outline" size={16} color="#67d6ff"/><Text style={s.aiText}>Insight demonstrativo · dados locais</Text></View></View></View>
   </ScrollView>
  </View>
 </View>
}
const s=StyleSheet.create({
 app:{flex:1,backgroundColor:'#050b14'},top:{minHeight:112,paddingHorizontal:28,paddingVertical:18,borderBottomWidth:1,borderBottomColor:'rgba(103,214,255,.13)',backgroundColor:'#06101d',flexDirection:'row',alignItems:'center',justifyContent:'space-between'},topMobile:{minHeight:126,paddingHorizontal:18},
 brandLine:{flexDirection:'row',alignItems:'baseline',gap:8},brand:{color:'#f4f9ff',fontSize:24,fontWeight:'900',letterSpacing:2},core:{color:'#2f91ff',fontSize:24,fontWeight:'900',letterSpacing:2},tag:{color:'#b3c3d5',fontSize:12,marginTop:4},by:{color:'#667d96',fontSize:9,fontWeight:'800',letterSpacing:1.8,marginTop:5},
 demo:{flexDirection:'row',alignItems:'center',gap:7,paddingHorizontal:11,paddingVertical:7,borderWidth:1,borderColor:'rgba(103,214,255,.2)',borderRadius:999,backgroundColor:'#09192d'},dot:{width:7,height:7,borderRadius:7,backgroundColor:'#67d6ff'},demoText:{color:'#b9dcff',fontSize:9,fontWeight:'900',letterSpacing:1},
 shell:{flex:1,flexDirection:'row'},shellMobile:{flexDirection:'column'},navFrame:{width:238,minWidth:238,maxWidth:238,flexGrow:0,flexShrink:0,backgroundColor:'#06101b',borderRightWidth:1,borderRightColor:'rgba(103,214,255,.1)'},navFrameMobile:{width:'100%',minWidth:0,maxWidth:'100%',height:70,flexShrink:0,borderRightWidth:0,borderBottomWidth:1,borderBottomColor:'rgba(103,214,255,.1)'},nav:{flex:1,width:'100%',paddingVertical:16},navMobile:{paddingVertical:0},navRow:{paddingHorizontal:8,alignItems:'center'},
 navItem:{flexDirection:'row',alignItems:'center',gap:11,marginHorizontal:10,marginVertical:3,paddingHorizontal:13,paddingVertical:12,borderRadius:13,borderWidth:1,borderColor:'transparent'},active:{backgroundColor:'#0b2038',borderColor:'rgba(47,145,255,.45)'},navText:{color:'#9dafc2',fontSize:13,fontWeight:'700'},navTextActive:{color:'#eef6ff'},
 content:{flex:1,minWidth:0},inner:{padding:28,maxWidth:1240,width:'100%',alignSelf:'center'},innerMobile:{padding:18},eyebrowRow:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',gap:8},eyebrow:{color:'#2f91ff',fontSize:10,fontWeight:'900',letterSpacing:1.5},status:{color:'#8ddf9a',fontSize:9,fontWeight:'800',letterSpacing:.8},title:{color:'#f4f9ff',fontSize:42,fontWeight:'900',letterSpacing:-1.4,marginTop:13},titleMobile:{fontSize:32},lead:{color:'#9cadc0',fontSize:15,lineHeight:23,marginTop:5,maxWidth:680},
 stats:{flexDirection:'row',gap:12,marginTop:25},statsMobile:{flexWrap:'wrap'},stat:{flex:1,minWidth:150,padding:17,borderRadius:18,borderWidth:1,borderColor:'rgba(103,214,255,.12)',backgroundColor:'#081629'},statValue:{color:'#f4f9ff',fontSize:23,fontWeight:'900'},statLabel:{color:'#8da0b5',fontSize:11,marginTop:4},spark:{height:3,width:'38%',borderRadius:3,backgroundColor:'#2f91ff',marginTop:14},
 grid:{flexDirection:'row',gap:14,marginTop:14},gridMobile:{flexDirection:'column'},card:{flex:1,padding:20,borderRadius:20,borderWidth:1,borderColor:'rgba(103,214,255,.12)',backgroundColor:'#071425'},cardHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},cardEyebrow:{color:'#2f91ff',fontSize:9,fontWeight:'900',letterSpacing:1.3},cardTitle:{color:'#eef6ff',fontSize:19,fontWeight:'800',marginTop:5},cardText:{color:'#9cadc0',fontSize:13,lineHeight:21,marginTop:14},line:{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:12,borderBottomWidth:1,borderBottomColor:'rgba(255,255,255,.05)'},lineIcon:{width:28,height:28,borderRadius:9,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(158,227,125,.08)'},lineIconBlue:{backgroundColor:'rgba(47,145,255,.1)'},lineText:{flex:1,color:'#dce9f6',fontSize:12,fontWeight:'600'},lineMeta:{color:'#71879e',fontSize:10},aiPill:{marginTop:18,alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:7,paddingHorizontal:11,paddingVertical:8,borderRadius:999,backgroundColor:'#09192d'},aiText:{color:'#9fcdf6',fontSize:10,fontWeight:'700'}
});