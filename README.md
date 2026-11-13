# SJ Workboard 읽기 전용 사본

노트북이 꺼져 있어도 폰에서 Today / Week / Month를 보기 위한 정적 사본이다.

- `build.mjs`가 `sj-workboard-data/board.json`을 읽어 화면을 만들고, 비밀번호로 AES-256-GCM(PBKDF2-SHA256 600,000회) 암호화해 `docs/index.html`에 쓴다.
- 비밀번호는 repo 밖(`sj-workboard-data/secrets/`)에만 있다. 이 repo에는 암호문만 올라간다.
- `publish.cmd`는 내용이 바뀐 경우에만 커밋·push한다. 작업 스케줄러가 15분마다 실행한다.
- 읽기 전용이다. 수정은 노트북의 Workboard(3210)에서 한다.
