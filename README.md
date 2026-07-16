# Projeto

Instruções mínimas para rodar o projeto localmente e preservar segredos.

## Pré-requisitos
- Python (backend)
- Node.js + npm/yarn (frontend)

## Setup
1. Copie os exemplos de variáveis de ambiente e preencha os valores locais:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# editar backend/.env e frontend/.env com valores reais (NÃO commitar estes arquivos)
```

2. Instale dependências e rode os serviços (exemplos):

```bash
# Backend
cd backend
pip install -r requirements.txt
python server.py

# Frontend
cd ../frontend
npm install
npm start
```

## Testes
- Backend: `pytest` no diretório `backend/tests`.

## Segurança e Git
- Os arquivos `.env` foram removidos do histórico e adicionados ao `.gitignore`.
- Use `backend/.env.example` e `frontend/.env.example` para documentar variáveis necessárias.
- Não commite segredos. Para variáveis secretas em CI/CD, use GitHub Secrets ou um vault.

Se quiser, eu posso adicionar instruções mais detalhadas (scripts de setup, commands de deploy, ou CI). 

