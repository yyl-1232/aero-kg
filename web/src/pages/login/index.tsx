import SvgIcon from '@/components/svg-icon';
import { useAuth } from '@/hooks/auth-hooks';
import {
  useLogin,
  useLoginChannels,
  useLoginWithChannel,
  useRegister,
  useRequestVerificationCode,
  useResetPassword,
} from '@/hooks/login-hooks';
import { useSystemConfig } from '@/hooks/system-hooks';
import { rsaPsw } from '@/utils';
import { Button, Checkbox, Form, Input, message } from 'antd';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'umi';
import styles from './index.less';
import RightPanel from './right-panel';

type PageState = 'login' | 'register' | 'forgot-password';

const Login = () => {
  // const [title, setTitle] = useState<'login' | 'register'>('login');
  const [pageState, setPageState] = useState<PageState>('login');
  const [showCodeStep, setShowCodeStep] = useState(false); // 找回密码第二步状态

  const navigate = useNavigate();
  const { login, loading: signLoading } = useLogin();
  const { register, loading: registerLoading } = useRegister();
  const { requestVerificationCode, loading: VerificationLoading } =
    useRequestVerificationCode();
  const { resetPassword, loading: resetPasswordLoading } = useResetPassword();
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
    loginWithChannelLoading ||
    VerificationLoading ||
    resetPasswordLoading;
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

  const goLogin = () => {
    setPageState('login');
    setShowCodeStep(false);
    form.resetFields();
  };
  const goRegister = () => {
    setPageState('register');
    setShowCodeStep(false);
    form.resetFields();
  };
  const goForgot = () => {
    setPageState('forgot-password');
    setShowCodeStep(false);
    form.resetFields();
  };

  const onCheck = async () => {
    try {
      const params = await form.validateFields();
      // const rsaPassWord = rsaPsw(params.password) as string;

      if (pageState === 'login') {
        const rsaPassWord = rsaPsw(params.password) as string;
        const code = await login({
          email: params.email.trim(),
          password: rsaPassWord,
        });
        if (code === 0) navigate('/');
      } else if (pageState === 'register') {
        const rsaPassWord = rsaPsw(params.password) as string;
        const code = await register({
          nickname: params.nickname,
          email: params.email,
          password: rsaPassWord,
        });
        if (code === 0) setPageState('login');
      } else if (pageState === 'forgot-password') {
        if (!showCodeStep) {
          // Step 1: 请求验证码
          const respCode = await requestVerificationCode({
            email: params.email.trim(),
            nickname: params.nickname,
          });
          // && respCode.data?.verification_code
          console.log('resp from backend:', respCode);
          if (respCode.code === 0) {
            console.log('respCode.data.data:', respCode.data.verification_code);
            message.info(
              `验证码（五分钟有效）: ${respCode.data.verification_code}`,
            );
            setShowCodeStep(true);
          } else {
            message.error('未找到用户，账户信息有误');
          }
        } else {
          // Step 2: 提交验证码 + 新密码
          const rsaPassWord = rsaPsw(params.new_password) as string;
          const respCode = await resetPassword({
            email: params.email.trim(),
            code: params.code,
            new_password: rsaPassWord,
          });
          if (respCode === 0) {
            message.success('密码重置成功，即将进入登录界面...');
            goLogin();
          } else {
            message.error('密码重置失败');
          }
        }
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
            <div>
              {pageState === 'login'
                ? t('login')
                : pageState === 'register'
                  ? t('register')
                  : t('forgotPassword')}
            </div>
            <span>
              {pageState === 'login'
                ? t('loginDescription')
                : pageState === 'register'
                  ? t('registerDescription')
                  : t('forgotPasswordDescription')}
            </span>
          </div>

          <Form
            form={form}
            layout="vertical"
            name="dynamic_rule"
            style={{ maxWidth: 400, margin: '0 auto' }}
          >
            {/* 邮箱：登录 / 注册 / 找回密码通用 */}
            <Form.Item
              {...formItemLayout}
              name="email"
              label={t('emailLabel')}
              rules={[{ required: true, message: t('emailPlaceholder') }]}
            >
              <Input size="large" placeholder={t('emailPlaceholder')} />
            </Form.Item>
            {/* 昵称：注册 / 找回密码第一步 */}
            {(pageState === 'register' ||
              (pageState === 'forgot-password' && !showCodeStep)) && (
              <Form.Item
                {...formItemLayout}
                name="nickname"
                label={t('nicknameLabel')}
                rules={[{ required: true, message: t('nicknamePlaceholder') }]}
              >
                <Input size="large" placeholder={t('nicknamePlaceholder')} />
              </Form.Item>
            )}

            {/* 密码：登录 / 注册 */}
            {(pageState === 'login' || pageState === 'register') && (
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
            )}

            {/* 找回密码 Step 2: 验证码 + 新密码 */}
            {pageState === 'forgot-password' && showCodeStep && (
              <>
                <Form.Item
                  {...formItemLayout}
                  name="code"
                  label={t('verificationCode')}
                  rules={[
                    {
                      required: true,
                      message: t('verificationCodePlaceholder'),
                    },
                  ]}
                >
                  <Input
                    size="large"
                    placeholder={t('verificationCodePlaceholder')}
                  />
                </Form.Item>

                <Form.Item
                  {...formItemLayout}
                  name="new_password"
                  label={t('newPasswordLabel')}
                  rules={[
                    { required: true, message: t('newPasswordPlaceholder') },
                  ]}
                >
                  <Input.Password
                    size="large"
                    placeholder={t('newPasswordPlaceholder')}
                    onPressEnter={onCheck}
                  />
                </Form.Item>
              </>
            )}

            {/* 登录记住我 */}
            {pageState === 'login' && (
              <Form.Item name="remember" valuePropName="checked">
                <Checkbox>{t('rememberMe')}</Checkbox>
              </Form.Item>
            )}

            {/* 页面切换链接 */}
            <div>
              {pageState === 'login' && registerEnabled && (
                <div
                  style={{ display: 'flex', justifyContent: 'space-between' }}
                >
                  <div>
                    {t('signInTip')}
                    <Button type="link" onClick={goRegister}>
                      {t('signUp')}
                    </Button>
                  </div>
                  <div>
                    {t('forgotPasswordTip')}
                    <Button type="link" onClick={goForgot}>
                      {t('forgotPassword')}
                    </Button>
                  </div>
                </div>
              )}

              {pageState === 'register' && (
                <div>
                  {t('signUpTip')}
                  <Button type="link" onClick={goLogin}>
                    {t('login')}
                  </Button>
                </div>
              )}

              {pageState === 'forgot-password' && (
                <div>
                  <Button type="link" onClick={goLogin}>
                    ← {t('login')}
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
              {pageState === 'login' && t('login')}
              {pageState === 'register' && t('continue')}
              {pageState === 'forgot-password' &&
                !showCodeStep &&
                t('getVerificationCode')}
              {pageState === 'forgot-password' &&
                showCodeStep &&
                t('resetPassword')}
            </Button>

            {pageState === 'login' && channels?.length > 0 && (
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
