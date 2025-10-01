import SvgIcon from '@/components/svg-icon';
import { useAuth } from '@/hooks/auth-hooks';
import {
  useLogin,
  useLoginChannels,
  useLoginWithChannel,
  useRegister,
} from '@/hooks/login-hooks';
import { useSystemConfig } from '@/hooks/system-hooks';
import { rsaPsw } from '@/utils';
import { Button, Checkbox, Form, Input } from 'antd';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'umi';
import styles from './index.less';
import RightPanel from './right-panel';

const Login = () => {
  const [title, setTitle] = useState<'login' | 'register'>('login');
  const navigate = useNavigate();
  const { login, loading: signLoading } = useLogin();
  const { register, loading: registerLoading } = useRegister();
  const { channels, loading: channelsLoading } = useLoginChannels();
  const { login: loginWithChannel, loading: loginWithChannelLoading } =
    useLoginWithChannel();
  const { t } = useTranslation('translation', { keyPrefix: 'login' });
  const { config } = useSystemConfig();
  const { isLogin } = useAuth();

  const loading =
    signLoading ||
    registerLoading ||
    channelsLoading ||
    loginWithChannelLoading;
  const registerEnabled = config?.registerEnabled !== 0;

  const [form] = Form.useForm();

  useEffect(() => {
    if (isLogin) {
      navigate('/');
    }
  }, [isLogin, navigate]);

  useEffect(() => {
    form.validateFields(['nickname']);
  }, [form]);

  const handleLoginWithChannel = async (channel: string) => {
    await loginWithChannel(channel);
  };

  const changeTitle = () => {
    if (title === 'login' && !registerEnabled) return;
    setTitle((prev) => (prev === 'login' ? 'register' : 'login'));
  };

  const onCheck = async () => {
    try {
      const params = await form.validateFields();
      const rsaPassWord = rsaPsw(params.password) as string;

      if (title === 'login') {
        const code = await login({
          email: params.email.trim(),
          password: rsaPassWord,
        });
        if (code === 0) navigate('/');
      } else {
        const code = await register({
          nickname: params.nickname,
          email: params.email,
          password: rsaPassWord,
        });
        if (code === 0) setTitle('login');
      }
    } catch (errorInfo) {
      console.log('Failed:', errorInfo);
    }
  };

  const formItemLayout = {
    labelCol: { span: 6 },
  };

  return (
    <div className={styles.loginPage}>
      {/* 顶部右侧标题区 */}
      <div className={styles.loginHeader}>
        <RightPanel />
      </div>

      {/* 登录表单区域 */}
      <div className={styles.loginContent}>
        <div className={styles.leftContainer}>
          <div className={styles.loginTitle}>
            <div>{title === 'login' ? t('login') : t('register')}</div>
            <span>
              {title === 'login'
                ? t('loginDescription')
                : t('registerDescription')}
            </span>
          </div>

          <Form
            form={form}
            layout="vertical"
            name="dynamic_rule"
            style={{ maxWidth: 400, margin: '0 auto' }}
          >
            <Form.Item
              {...formItemLayout}
              name="email"
              label={t('emailLabel')}
              rules={[{ required: true, message: t('emailPlaceholder') }]}
            >
              <Input size="large" placeholder={t('emailPlaceholder')} />
            </Form.Item>

            {title === 'register' && (
              <Form.Item
                {...formItemLayout}
                name="nickname"
                label={t('nicknameLabel')}
                rules={[{ required: true, message: t('nicknamePlaceholder') }]}
              >
                <Input size="large" placeholder={t('nicknamePlaceholder')} />
              </Form.Item>
            )}

            <Form.Item
              {...formItemLayout}
              name="password"
              label={t('passwordLabel')}
              rules={[{ required: true, message: t('passwordPlaceholder') }]}
            >
              <Input.Password
                size="large"
                placeholder={t('passwordPlaceholder')}
                onPressEnter={onCheck}
              />
            </Form.Item>

            {title === 'login' && (
              <Form.Item name="remember" valuePropName="checked">
                <Checkbox>{t('rememberMe')}</Checkbox>
              </Form.Item>
            )}

            <div>
              {title === 'login' && registerEnabled && (
                <div
                  style={{ display: 'flex', justifyContent: 'space-between' }}
                >
                  <div>
                    {t('signInTip')}
                    <Button type="link" onClick={changeTitle}>
                      {t('signUp')}
                    </Button>
                  </div>
                  <div>
                    {t('forgotPasswordTip')}
                    <Button type="link" onClick={changeTitle}>
                      {t('forgotPassword')}
                    </Button>
                  </div>
                </div>
              )}

              {title === 'register' && (
                <div>
                  {t('signUpTip')}
                  <Button type="link" onClick={changeTitle}>
                    {t('login')}
                  </Button>
                </div>
              )}
            </div>

            <Button
              type="primary"
              block
              size="large"
              onClick={onCheck}
              loading={loading}
            >
              {title === 'login' ? t('login') : t('continue')}
            </Button>

            {title === 'login' && channels?.length > 0 && (
              <div className={styles.thirdPartyLoginButton}>
                {channels.map((item) => (
                  <Button
                    key={item.channel}
                    block
                    size="large"
                    onClick={() => handleLoginWithChannel(item.channel)}
                    style={{ marginTop: 10 }}
                  >
                    <div className="flex items-center">
                      <SvgIcon
                        name={item.icon || 'sso'}
                        width={20}
                        height={20}
                        style={{ marginRight: 5 }}
                      />
                      Sign in with {item.display_name}
                    </div>
                  </Button>
                ))}
              </div>
            )}
          </Form>
        </div>
      </div>
    </div>
  );
};

export default Login;
