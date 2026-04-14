echo ""
echo "=================================================="
echo "  ElektraPeru — Deploy en Minikube"
echo "=================================================="
echo ""

echo ">> Verificando Minikube..."
if ! minikube status | grep -q "Running"; then
  echo "   Minikube no está corriendo. Iniciando..."
  minikube start --driver=docker --memory=2200 --cpus=2
else
  echo "   Minikube ya está corriendo ✓"
fi

echo ""
echo ">> Apuntando Docker al daemon de Minikube..."
eval $(minikube docker-env)
echo "   Listo. Docker ahora construye dentro de Minikube ✓"

echo ""
echo ">> Construyendo imágenes Docker..."

echo "   Building servicio-validacion..."
docker build -t servicio-validacion:latest ./servicio-validacion
echo "   ✓ servicio-validacion"

echo "   Building servicio-correo..."
docker build -t servicio-correo:latest ./servicio-correo
echo "   ✓ servicio-correo"

echo "   Building servicio-registro..."
docker build -t servicio-registro:latest ./servicio-registro
echo "   ✓ servicio-registro"

echo ""
echo ">> Aplicando manifiestos en Kubernetes..."

kubectl apply -f k8s/validacion.yaml
kubectl apply -f k8s/correo.yaml
kubectl apply -f k8s/registro.yaml

echo "   Manifiestos aplicados ✓"

echo ""
echo ">> Esperando que los pods estén listos (máx 60 seg)..."
kubectl wait --for=condition=ready pod -l app=servicio-validacion --timeout=60s
kubectl wait --for=condition=ready pod -l app=servicio-correo     --timeout=60s
kubectl wait --for=condition=ready pod -l app=servicio-registro   --timeout=60s

echo ""
echo "=================================================="
echo "  Deploy completado"
echo "=================================================="
echo ""
echo "Pods corriendo:"
kubectl get pods
echo ""
echo "URL de la API (servicio-registro):"
minikube service servicio-registro --url
echo ""
echo "Para ver logs:"
echo "  kubectl logs -l app=servicio-registro -f"
echo "  kubectl logs -l app=servicio-validacion -f"
echo "  kubectl logs -l app=servicio-correo -f"