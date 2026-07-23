document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.pw-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const wrapper = btn.closest('.password-field');
      const input = wrapper.querySelector('input');
      const showing = input.type === 'text';

      input.type = showing ? 'password' : 'text';
      wrapper.querySelector('.icon-eye').style.display = showing ? 'block' : 'none';
      wrapper.querySelector('.icon-eye-off').style.display = showing ? 'none' : 'block';
      btn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
    });
  });
});