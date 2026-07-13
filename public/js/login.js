const form = document.getElementById('login-form');
const errorEl = document.getElementById('login-error');
const submitBtn = document.getElementById('submit-btn');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.hidden = true;

  const telefone = document.getElementById('telefone').value.trim();
  if (!telefone) return;

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Verificando...';

  try {
    const data = await api('/api/auth/client-login', {
      method: 'POST',
      body: JSON.stringify({ telefone })
    });
    toast(`Bem-vindo(a), ${data.nome}!`, 'success');
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 500);
  } catch (err) {
    errorEl.textContent = err.message === 'Acesso não encontrado.'
      ? 'Acesso não encontrado.'
      : err.message;
    errorEl.hidden = false;
    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Entrar <i class="fa-solid fa-arrow-right"></i>';
  }
});

// Máscara simples de telefone brasileiro
document.getElementById('telefone').addEventListener('input', (e) => {
  let v = e.target.value.replace(/\D/g, '').slice(0, 11);
  if (v.length > 6) v = v.replace(/(\d{2})(\d{5})(\d{0,4})/, '$1 $2-$3');
  else if (v.length > 2) v = v.replace(/(\d{2})(\d{0,5})/, '$1 $2');
  e.target.value = v.trim();
});
