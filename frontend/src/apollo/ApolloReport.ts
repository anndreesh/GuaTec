import type {ApolloSave} from './ApolloState';
import {apolloOperationLog} from './ApolloOperationLog';
import {apolloText} from './ApolloLocale';
import './ApolloReport.css';
const node=<K extends keyof HTMLElementTagNameMap>(tag:K,cls='',text='')=>{const element=document.createElement(tag);element.className=cls;element.textContent=apolloText(text);return element;};

/** The Apollo report records the player's support work, not legacy rocket-design metrics. */
export function renderApolloReport(host:HTMLElement,save:ApolloSave):void{
  const operations=apolloOperationLog(save),historical=operations.filter(item=>item.kind==='checkpoint'&&item.completed).length,stands=operations.filter(item=>item.kind==='stand'&&item.completed).length;
  const root=node('section','ap-report');
  root.append(node('small','ap-report-kicker','APOLLO 11 · LC-39A'),node('h3','','Registro de apoyo terrestre'),node('p','ap-report-intro','Una jornada de preparación, observación y registro desde el área segura.'));
  root.append(node('p','ap-report-completion',apolloText('Operaciones registradas: {count} de 15.').replace('{count}',String(historical+stands))));
  const metrics=node('dl','ap-report-metrics');
  for(const[label,value]of[['Hitos históricos',historical+'/8'],['Stands de apoyo',stands+'/7'],['Registro total',(historical+stands)+'/15']]){const metric=node('div');metric.append(node('dt','',label),node('dd','',value));metrics.append(metric);}
  root.append(metrics,node('h4','','Cronología de operaciones'));
  const list=node('ol','ap-report-operations');
  for(const operation of operations){
    const item=node('li','ap-report-operation');item.dataset.completed=String(operation.completed);
    item.setAttribute('aria-label',apolloText(operation.completed?'Registro completado':'Registro pendiente')+': '+apolloText(operation.title));
    const status=node('span','ap-report-check',operation.completed?'✓':'—');status.setAttribute('aria-hidden','true');
    const copy=node('div');copy.append(node('small','',operation.kind==='stand'?'Operación de apoyo':'Hito histórico'),node('strong','',operation.title));
    item.append(status,copy);list.append(item);
  }
  root.append(list,node('h4','','Referencia histórica · 16 de julio de 1969'),node('p','ap-report-reference','Apollo 11 despegó de la plataforma 39A a las 09:32 EDT. Las tareas de apoyo, los registros y Daniel Carter son adaptaciones educativas; el jugador observa el lanzamiento desde un área segura.'));
  const source=node('a','ap-report-source','NASA · Resumen de Apollo 11');source.href='https://www.nasa.gov/history/apollo-11-mission-overview/';source.target='_blank';source.rel='noopener noreferrer';root.append(source);host.append(root);
}
