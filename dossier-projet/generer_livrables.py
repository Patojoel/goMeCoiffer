"""Generate the project workbook tables, Word, PDF and ZIP from local sources.

Requires python-docx, reportlab, openpyxl, Graphviz and DejaVu fonts.
No network or credentials required.
"""
from pathlib import Path
from decimal import Decimal, ROUND_HALF_UP
import csv
import re
import zipfile
import subprocess
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parent

BACKLOG = [
('01','P0','Identité','Créer un compte et vérifier son téléphone','EX-09','Aucune','Session créée seulement après code valide ; limitation des tentatives'),
('02','P0','Sécurité','Isoler les salons et leurs rôles','EX-15,EX-21','01','Salon A ne lit ni ne modifie les objets du salon B'),
('03','P0','Salon','Créer et vérifier un salon','EX-11,EX-21','02','Publication et habilitation paiement contrôlées séparément'),
('04','P0','Catalogue','Configurer services, prix et durées','EX-12','03','Prix connu, durée positive et collaborateurs habilités'),
('05','P0','Médias','Publier les photos du salon','EX-05','03','Types et tailles contrôlés ; droits et retrait pris en compte'),
('06','P0','Marketplace','Rechercher par position ou quartier','EX-01,EX-02,EX-03','03,04','Recherche disponible sans GPS et filtres respectés'),
('07','P0','Marketplace','Afficher la fiche salon','EX-04','04,05','Prix, durée, horaires, locaux et conditions visibles'),
('08','P0','Agenda','Configurer horaires, pauses et congés','EX-13','04','Créneaux proposés respectent toutes les indisponibilités'),
('09','P0','Agenda','Acquérir un créneau atomiquement','EX-07','08','50 tentatives simultanées ne produisent qu’une occupation'),
('10','P0','Agenda','Accepter les demandes manuelles','EX-07','09','Aucun débit avant acceptation ; expiration explicite'),
('11','P0','Agenda','Ajouter téléphone et passage sur place','EX-13','09','Même protection contre les conflits que la marketplace'),
('12','P0','Paiement','Calculer le devis versionné','EX-08,PAY-02','04','Prix, remises, frais, devise et total exacts avant accord'),
('13','P0','Paiement','Intégrer l’intention de paiement','PAY-03','09,12','Idempotence et contrôle du montant en sandbox'),
('14','P0','Paiement','Traiter les webhooks signés','PAY-03','13','Signature vérifiée, événements dupliqués sans double effet'),
('15','P0','Paiement','Traiter succès tardif et expiration','RM-02','14','Créneau indisponible entraîne remboursement intégral'),
('16','P0','Agenda','Confirmer sans paiement en ligne','EX-07,RM-03','09','Créneau protégé ; absence de fidélité liée aux espèces'),
('17','P0','Notifications','Envoyer confirmation et rappels','EX-09','14,16','Messages dédupliqués ; état visible même si SMS échoue'),
('18','P0','Agenda','Reporter atomiquement','RM-06','09,12','Échec laisse l’ancien rendez-vous intact'),
('19','P0','Annulation','Calculer pénalité et remboursement','RM-05,PAY-04','12,14','Politique acceptée conservée ; seuil exact respecté'),
('20','P0','Paiement','Exécuter les remboursements','PAY-04','19','Pas de double remboursement ; erreurs suivies'),
('21','P0','Présence','Enregistrer arrivée et réalisation','EX-14','11','Code validé par salon ; historique des corrections'),
('22','P0','Présence','Gérer retard, absence et recours','RM-04,RM-08','19,21','Le client suivant garde son créneau ; absence contestable'),
('23','P0','Finance','Construire le journal et rapprochement','PAY-05','14,20','Écritures équilibrées et écarts prestataire identifiés'),
('24','P0','Finance','Différer et suivre le reversement','PAY-05','21,23','Fonds en litige bloqués ; confirmation fournisseur exigée'),
('25','P0','Fidélité','Configurer un programme versionné','EX-17','03','Droits acquis préservés après modification'),
('26','P0','Fidélité','Créditer une visite admissible','RM-07','14,21,25','Paiement en ligne et réalisation requis ; crédit unique'),
('27','P0','Fidélité','Réserver et utiliser un avantage','RM-07','12,26','Une seule consommation concurrente ; frais sur prix réduit'),
('28','P0','Fidélité','Corriger les droits après remboursement','RM-07','20,27','Journal compensatoire et avantage restitué si applicable'),
('29','P0','Client','Afficher historique, reçus et avantages','EX-09','20,26','Le client ne voit que ses propres informations'),
('30','P0','Avis','Publier un avis de visite vérifiée','EX-06','21','Un avis par rendez-vous réalisé, paiement non obligatoire'),
('31','P0','Support','Traiter incidents et litiges','EX-10,EX-23','20,22,24','Décision justifiée ; reversement concerné suspendu'),
('32','P0','Abonnement','Gérer essai, souscription et factures','EX-19','03,13','Tarif et consentement avant facturation'),
('33','P0','Abonnement','Gérer grâce et suspension','RM-09','32','Les rendez-vous existants et remboursements restent accessibles'),
('34','P0','Pilotage','Afficher les indicateurs essentiels','EX-20,EX-25','23,29,32','CA salon, encaissements et revenus plateforme séparés'),
('35','P0','Exploitation','Sauvegarder, restaurer et alerter','EX-25','23','Restauration testée et délais mesurés'),
('36','P0','Qualité','Exécuter recette sécurité et concurrence','REC-01 à REC-30','01-35','Aucun défaut bloquant ; résultats et version conservés'),
('37','P1','Agenda','Automatiser la liste d’attente','EX-13','09,17','Créneau proposé sans double confirmation'),
('38','P1','Marketing','Ajouter un parrainage contrôlé','RM-07','26','Attribution après visite admissible ; auto-parrainage bloqué'),
('39','P1','Pilotage','Exporter et analyser les cohortes','EX-20','34','Périodes et exclusions explicites ; export autorisé seulement'),
('40','P1','Organisation','Gérer plusieurs établissements','EX-15','02,34','Droits par établissement et consolidation autorisée'),
('41','P1','Agenda','Gérer les ressources partagées','EX-13','09','Une ressource ne peut pas être occupée simultanément'),
('42','P2','Mobile','Développer les applications natives','EX-09','36','Parité avec règles serveur et reprise de paiement'),
('43','P2','Commerce','Ajouter stocks et vente de produits','EX-18','23','Ventes et stocks rapprochés avec règles dédiées'),
]

def csv_write(name, fields, rows):
    with (ROOT / name).open('w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f, delimiter=';')
        w.writerow(fields)
        w.writerows(rows)

csv_write('backlog.csv', ['ID','Priorité','Module','Fonctionnalité','Références','Dépendances BL','Critère de réception'],
          [('BL-'+n,p,m,t,r,d,a) for n,p,m,t,r,d,a in BACKLOG])

recette = []
for line in (ROOT/'08-recette-et-qualite.md').read_text().splitlines():
    if line.startswith('| REC-'):
        ident, scenario, expected = [c.strip() for c in line.strip('|').split('|')]
        recette.append([ident, scenario, expected, 'Non exécuté — application non développée', '', '', ''])
csv_write('matrice-recette.csv', ['ID','Scénario','Résultat attendu','Statut','Version testée','Preuve','Anomalie'], recette)

D = Decimal
def money(x):
    return str(D(x).quantize(D('0.01'), rounding=ROUND_HALF_UP))
def whole(x):
    return D(x).quantize(D('1'), rounding=ROUND_HALF_UP)

rows = []
for p in map(D, ['1000','2500','5000','10000']):
    fee, displayed = whole(p*D('.05')), whole(p*D('.03'))
    total = p+fee+displayed
    for base in ['prix prestation', 'total encaissé']:
        cost = (p if base == 'prix prestation' else total)*D('.03')
        net = total-p-cost
        assert total == p+fee+displayed
        rows.append([money(p), '5%', '3%', base, money(fee), money(displayed), money(total), money(cost), money(net), 'Théorique avant arrondi prestataire, fiscalité et autres coûts'])
csv_write('simulation-frais.csv', ['Prix net FCFA','Taux plateforme','Taux agrégateur','Base agrégateur','Frais plateforme affichés','Frais paiement affichés','Total client','Coût agrégateur théorique','Marge transactionnelle théorique','Limite'], rows)

scenarios = [('Pilote gratuit',15,0,20,2500,300,60000),('Début commercial',40,5000,40,3000,300,350000),('Croissance illustrative',100,5000,80,3500,300,1200000)]
monthly = []
for name,salons,sub,visits,basket,cost_per_salon,fixed in scenarios:
    n = salons*visits
    volume = D(n*basket)
    billed = volume*D('.05')
    charge_client = volume*D('1.08')
    aggregator = charge_client*D('.03')
    margin = charge_client-volume-aggregator
    subscriptions = D(salons*sub)
    costs = D(salons*cost_per_salon)
    operating = subscriptions+margin-costs-D(fixed)
    monthly.append([name,salons,sub,visits,basket,n,money(volume),money(subscriptions),money(billed),money(aggregator),money(margin),money(costs),fixed,money(operating),'Hypothèses : toutes visites comptées payées en ligne et réalisées ; agrégateur 3% du total ; hors remboursements, impôts et acquisition non incluse dans coûts fixes'])
csv_write('simulation-financiere.csv', ['Scénario hypothétique','Salons','Abonnement mensuel FCFA','Visites en ligne réalisées par salon','Panier net FCFA','Visites totales','Volume prestations FCFA','Abonnements FCFA','Frais plateforme facturés FCFA','Coût agrégateur FCFA','Marge transactionnelle FCFA','Autres coûts variables FCFA','Coûts fixes hypothétiques FCFA','Solde indicatif avant impôt FCFA','Hypothèses et limites'], monthly)

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter
wb=Workbook(); wb.remove(wb.active)
for filename,sheet in [('backlog.csv','Backlog'),('matrice-recette.csv','Recette'),('simulation-frais.csv','Frais'),('simulation-financiere.csv','Scénarios mensuels')]:
    ws=wb.create_sheet(sheet)
    with (ROOT/filename).open(encoding='utf-8-sig') as f:
        for row_index,row in enumerate(csv.reader(f,delimiter=';'),1):
            ws.append([float(v) if row_index>1 and re.fullmatch(r'-?\d+(\.\d+)?',v) else v for v in row])
    ws.freeze_panes='A2'; ws.auto_filter.ref=ws.dimensions
    for cell in ws[1]:
        cell.font=Font(color='FFFFFF',bold=True)
        cell.fill=PatternFill('solid',fgColor='153F4C')
        cell.alignment=Alignment(wrap_text=True,vertical='top')
    ws.row_dimensions[1].height=60
    for row in ws.iter_rows(min_row=2):
        ws.row_dimensions[row[0].row].height=60
        for c in row:
            c.alignment=Alignment(wrap_text=True,vertical='top')
            if c.row%2==0: c.fill=PatternFill('solid',fgColor='F0F4F5')
    for col in ws.columns:
        maxlen=max(len(str(c.value or '')) for c in col)
        ws.column_dimensions[get_column_letter(col[0].column)].width=min(60,max(15,maxlen*.7))
wb.save(ROOT/'goMeCoiffer-tableaux.xlsx')

diagrams={
'architecture': '''digraph G {
graph [rankdir=LR, bgcolor="white", pad="0.2", nodesep="0.3"];
node [shape=box, style="rounded,filled", fillcolor="#F0F4F5", color="#153F4C", fontname="DejaVu Sans", fontsize=11];
edge [color="#537980"];
C [label="Client PWA"]; S [label="Back-office salon"]; A [label="Administration"];
API [label="API métier"]; DB [label="PostgreSQL / PostGIS",shape=cylinder];
OBJ [label="Photos"]; PAY [label="Agrégateur"]; WH [label="Webhooks vérifiés"];
W [label="Outbox et workers"]; MSG [label="Notifications"];
C -> API; S -> API; A -> API; API -> DB; API -> OBJ; API -> PAY;
PAY -> WH; WH -> API; DB -> W; W -> MSG; W -> PAY;
}''',
'donnees': '''digraph G {
graph [rankdir=LR, bgcolor="white", pad="0.2", nodesep="0.3"];
node [shape=box, style="rounded,filled", fillcolor="#F0F4F5", color="#153F4C", fontname="DejaVu Sans", fontsize=11];
edge [color="#537980",fontname="DejaVu Sans",fontsize=9];
U [label="Client"]; S [label="Salon"]; ST [label="Collaborateur"]; SV [label="Prestation"];
B [label="Rendez-vous"]; BI [label="Ligne de prestation"]; P [label="Paiement"]; R [label="Remboursement"];
L [label="Écriture de fidélité"]; RE [label="Récompense"]; T [label="Reversement"]; SU [label="Abonnement"];
U -> B [label="1 → N"]; S -> B [label="1 → N"]; S -> ST [label="1 → N"];
S -> SV [label="1 → N"]; ST -> B [label="1 → N"]; B -> BI [label="1 → N"];
B -> P [label="1 → N tentatives"]; P -> R [label="1 → N"];
B -> L [label="1 → N"]; S -> RE [label="1 → N"]; U -> RE [label="1 → N"];
S -> T [label="1 → N"]; S -> SU [label="1 → N historique"];
}'''}
for name,source in diagrams.items():
    dot=ROOT/f'schema-{name}.dot'; dot.write_text(source)
    subprocess.run(['dot','-Tpng','-Gdpi=160',str(dot),'-o',str(ROOT/f'schema-{name}.png')],check=True)

def diagram_path(value):
    if value.startswith('flowchart'): return ROOT/'schema-architecture.png'
    if value.startswith('erDiagram'): return ROOT/'schema-donnees.png'
    return None

# Minimal Markdown reader shared by the two exports.
def blocks(text):
    lines = text.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i]
        if not line.strip():
            i += 1; continue
        if line.startswith('```'):
            code = []; i += 1
            while i < len(lines) and not lines[i].startswith('```'):
                code.append(lines[i]); i += 1
            yield 'code', '\n'.join(code)
        elif line.startswith('|'):
            table = []
            while i < len(lines) and lines[i].startswith('|'):
                cells = [c.strip() for c in lines[i].strip('|').split('|')]
                if not all(re.fullmatch(r'[:\- ]+', c) for c in cells):
                    table.append(cells)
                i += 1
            yield 'table', table
            continue
        elif line.startswith('#'):
            level = len(line)-len(line.lstrip('#'))
            yield 'h'+str(level), line[level:].strip()
        elif line.startswith('- '):
            yield 'bullet', line[2:]
        else:
            para = [line]
            while i+1<len(lines) and lines[i+1].strip() and not lines[i+1].startswith(('#','|','- ','```')):
                i += 1; para.append(lines[i])
            yield 'p', ' '.join(para)
        i += 1

def plain(text):
    text = re.sub(r'\[([^]]+)\]\([^)]+\)', r'\1', text)
    return text.replace('**','').replace('`','')

sources = sorted(ROOT.glob('[0-9][0-9]-*.md'))
from docx import Document
from docx.shared import Cm, Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

doc = Document()
sec = doc.sections[0]
sec.top_margin = sec.bottom_margin = Cm(1.8)
sec.left_margin = sec.right_margin = Cm(1.7)
normal = doc.styles['Normal']
normal.font.name = 'Calibri'; normal.font.size = Pt(10)
normal.paragraph_format.space_after = Pt(6)
for name in ['Title','Heading 1','Heading 2','Heading 3']:
    doc.styles[name].font.color.rgb = RGBColor.from_string('153F4C')
doc.add_heading('goMeCoiffer',0)
doc.add_paragraph('DOSSIER COMPLET DE CONCEPTION', 'Subtitle')
doc.add_paragraph('Cahier des charges • Règles métier • Finance • Architecture • Recette • Lancement')
doc.add_paragraph('Version 1.0 — 4 novembre 2026')
doc.add_paragraph('Base de réalisation et de consultation. Les paramètres proposés sont distingués des décisions validées. Application non développée à ce stade.')
footer = sec.footer.paragraphs[0]
footer.text = 'goMeCoiffer — Dossier v1.0 | '
field = OxmlElement('w:fldSimple'); field.set(qn('w:instr'),'PAGE'); footer._p.append(field)
for source in sources:
    doc.add_page_break()
    for kind,value in blocks(source.read_text()):
        if kind.startswith('h'):
            doc.add_heading(plain(value), min(int(kind[1:]),3))
        elif kind == 'table':
            t = doc.add_table(rows=1, cols=len(value[0])); t.style='Light Shading Accent 1'
            for j,cell in enumerate(value[0]): t.rows[0].cells[j].text=plain(cell)
            header = OxmlElement('w:tblHeader'); t.rows[0]._tr.get_or_add_trPr().append(header)
            for row in value[1:]:
                cells=t.add_row().cells
                for j,cell in enumerate(row): cells[j].text=plain(cell)
            doc.add_paragraph()
        elif kind=='code':
            diagram=diagram_path(value)
            if diagram:
                doc.add_picture(str(diagram),width=Cm(17))
            else:
                p=doc.add_paragraph()
                r=p.add_run(value); r.font.name='Consolas'; r.font.size=Pt(8)
        else:
            doc.add_paragraph(plain(value), 'List Bullet' if kind=='bullet' else None)
doc.save(ROOT/'goMeCoiffer-dossier-complet.docx')

from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Image
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

fontdir = Path('/usr/share/fonts/truetype/dejavu')
pdfmetrics.registerFont(TTFont('DejaVu', str(fontdir/'DejaVuSans.ttf')))
pdfmetrics.registerFont(TTFont('DejaVuBold', str(fontdir/'DejaVuSans-Bold.ttf')))
styles = getSampleStyleSheet()
for name in ['Normal','BodyText']:
    styles[name].fontName='DejaVu'; styles[name].fontSize=9; styles[name].leading=13
for name,size in [('Title',28),('Heading1',19),('Heading2',13),('Heading3',11)]:
    styles[name].fontName='DejaVuBold'; styles[name].fontSize=size; styles[name].leading=size+5
    styles[name].textColor=colors.HexColor('#153F4C')
styles.add(ParagraphStyle(name='Cell',fontName='DejaVu',fontSize=7.2,leading=10,spaceAfter=0,wordWrap='LTR'))
styles.add(ParagraphStyle(name='CellHeader',parent=styles['Cell'],fontName='DejaVuBold',textColor=colors.white))
styles.add(ParagraphStyle(name='CodeBlock',parent=styles['BodyText'],fontSize=7,leading=10,backColor=colors.HexColor('#F0F4F5')))

def para(t, style='BodyText'):
    return Paragraph(escape(plain(t)).replace('\n','<br/>'),styles[style])
story=[para('goMeCoiffer','Title'),Spacer(1,20),para('Dossier complet de conception','Heading1'),para('Cahier des charges, règles métier, paiements, parcours, architecture, données, réalisation, recette et lancement.'),Spacer(1,16),para('Version 1.0 — 4 novembre 2026'),para('Base de réalisation et de consultation. Les décisions validées et les propositions sont distinguées. Ce document ne constitue pas une application développée ni une intégration de paiement testée.')]
width=A4[0]-88
for source in sources:
    story.append(PageBreak())
    for kind,value in blocks(source.read_text()):
        if kind.startswith('h'):
            story.append(para(value,'Heading'+str(min(int(kind[1:]),3))))
        elif kind=='table':
            n=len(value[0]); data=[]
            for idx,row in enumerate(value):
                data.append([para(c,'CellHeader' if idx==0 else 'Cell') for c in row])
            weights = [1]*n
            if n==3: weights=[1,1.6,2]
            if n==4: weights=[.7,1.3,1.7,2]
            t=Table(data,colWidths=[width*w/sum(weights) for w in weights],repeatRows=1,hAlign='LEFT')
            t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#153F4C')),('VALIGN',(0,0),(-1,-1),'TOP'),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,colors.HexColor('#F0F4F5')]),('GRID',(0,0),(-1,-1),.3,colors.HexColor('#CAD8DB')),('LEFTPADDING',(0,0),(-1,-1),6),('RIGHTPADDING',(0,0),(-1,-1),6),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6)]))
            story.extend([t,Spacer(1,10)])
        elif kind=='code':
            diagram=diagram_path(value)
            if diagram:
                im=Image(str(diagram)); scale=min(width/im.imageWidth,380/im.imageHeight)
                im.drawWidth=im.imageWidth*scale; im.drawHeight=im.imageHeight*scale
                story.extend([im,Spacer(1,8)])
            else:
                story.extend([para(value,'CodeBlock'),Spacer(1,8)])
        else:
            story.append(para(('• ' if kind=='bullet' else '')+value))

def page_footer(canvas, document):
    canvas.saveState(); canvas.setFont('DejaVu',8); canvas.setFillColor(colors.HexColor('#536A72'))
    canvas.drawString(44,24,'goMeCoiffer — Dossier de conception v1.0')
    canvas.drawRightString(A4[0]-44,24,str(document.page)); canvas.restoreState()

SimpleDocTemplate(str(ROOT/'goMeCoiffer-dossier-complet.pdf'),pagesize=A4,rightMargin=44,leftMargin=44,topMargin=40,bottomMargin=42,title='goMeCoiffer — Dossier complet de conception',author='Projet goMeCoiffer').build(story,onFirstPage=page_footer,onLaterPages=page_footer)

archive=ROOT/'goMeCoiffer-dossier-complet.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for path in sorted(ROOT.iterdir()):
        if path.is_file() and path!=archive:
            z.write(path,arcname='goMeCoiffer-dossier/'+path.name)
print(f'Generated {len(sources)} source chapters, {len(BACKLOG)} backlog items, {len(recette)} test cases, Word, PDF and ZIP.')
