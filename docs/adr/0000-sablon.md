# ADR-NNNN: <döntés címe>

- Állapot: javasolt | elfogadott | felváltva (ADR-XXXX)
- Dátum: ÉÉÉÉ-HH-NN
- Döntéshozók: <csak akik a döntést kifejezetten jóváhagyták: SMark2256, ricsmond12>
- Jóváhagyás: <ki, mikor, hol: opciós kérdés válasza, Jira-komment vagy egy korábbi PR kommentjének linkje>
- Ticket: KG-<n>

## Kontextus

Mi a helyzet, milyen kényszerek vannak, mi a probléma. Tények, számok, hivatkozások. A repó állapotára
vonatkozó állítást (fájl létezik, a compose tartalmaz valamit, egy konvenció így működik) paranccsal
ellenőrizd (`git grep`), mielőtt leírod; ami még nincs meg, azt jövő időben, a követő ticket jelzésével írd.

## Döntés

Mit választunk, egyértelműen. Egy ADR ne mondjon ellent önmagának, és egy elfogadott ADR-nek sem, hacsak
nem váltja fel kifejezetten; ilyenkor a régi ADR állapota `felváltva (ADR-NNNN)` lesz.

## Következmények

Mi lesz könnyebb, mi lesz nehezebb, mit kell megcsinálni miatta. Melyik skillt és a `kg-stack` melyik
sorát frissítettük. A követő ticketek (ahol a döntés megvalósul) kulcsa.

## Mérlegelt alternatívák

| Alternatíva | Miért nem |
| ----------- | --------- |
